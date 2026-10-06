import type sql from "mssql";

import type {
  ISqlServerRepository,
  SqlServerExecutionResult,
  SqlTable,
} from "../../core/interfaces/ISqlServerRepository.js";
import type { OutputLimits } from "../../core/sql/SqlResult.js";
import {
  classifySqlOperation,
  isSingleReadStatement,
  normalizeCell,
  resolveRowLimit,
  toMutationType,
} from "../../core/sql/sqlUtils.js";
import type { SqlServerConnectionManager } from "./SqlServerConnectionManager.js";

export class SqlServerSqlError extends Error {
  public override readonly name = "SqlServerSqlError";

  constructor(
    public readonly query: string,
    cause: string,
  ) {
    super(`[MSSQL Error] ${cause}`);
  }
}

interface MutableTable {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated?: true;
}

interface BatchOutcome {
  tables: MutableTable[];
  rowsAffected: number;
}

export class SqlServerRepository implements ISqlServerRepository {
  constructor(
    private readonly conn: SqlServerConnectionManager,
    private readonly limits: OutputLimits,
  ) {}

  async executeSql(query: string, maxRows?: number): Promise<SqlServerExecutionResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Error("La consulta SQL no puede estar vacía.");

    const operation = classifySqlOperation(trimmedQuery);

    console.error(
      `[MSSQL:SQL:${operation}] ${trimmedQuery.length > 120 ? trimmedQuery.substring(0, 120) + "…" : trimmedQuery}`,
    );

    let pool: sql.ConnectionPool;
    try {
      pool = await this.conn.getPool();
    } catch (err: any) {
      throw new SqlServerSqlError(trimmedQuery, `No se pudo obtener el pool de conexiones: ${err.message}`);
    }

    const limit = resolveRowLimit(maxRows, this.limits.defaultMaxRows);
    const { tables, rowsAffected } = await this.run(
      pool,
      trimmedQuery,
      limit,
      isSingleReadStatement(trimmedQuery),
    );

    // Se decide por lo que devolvió el servidor, no por la primera palabra:
    // así `WITH … SELECT`, `EXEC sp_…` o un SELECT precedido de comentarios
    // también devuelven sus filas.
    if (tables.length === 0) {
      return { operation: toMutationType(operation), rowsAffected };
    }

    const [first, ...rest]: SqlTable[] = tables;
    return {
      operation: "SELECT",
      ...first!,
      ...(rest.length ? { moreResults: rest } : {}),
    };
  }

  async close(): Promise<void> {}

  /**
   * Ejecuta en modo streaming y guarda como máximo `limit` filas por result
   * set. A diferencia de `SET ROWCOUNT`, no limita UPDATE/DELETE ni deja la
   * opción activa en la conexión del pool. Si la consulta es un único SELECT,
   * al superar el límite se cancela para no transferir el resto de la tabla.
   */
  private run(
    pool: sql.ConnectionPool,
    query: string,
    limit: number,
    cancelWhenFull: boolean,
  ): Promise<BatchOutcome> {
    return new Promise((resolve, reject) => {
      const request = pool.request();
      request.stream = true;
      request.arrayRowMode = true;

      const tables: MutableTable[] = [];
      const errors: string[] = [];
      let current: MutableTable | undefined;
      let rowsAffected = 0;
      let cancelled = false;

      request.on("recordset", (columns: Array<{ name: string }>) => {
        current = { columns: columns.map((c) => c.name), rows: [], rowCount: 0 };
        tables.push(current);
      });

      request.on("row", (row: unknown[] | Record<string, unknown>) => {
        if (!current) return;
        if (current.rows.length < limit) {
          // FOR JSON / FOR XML llegan como un único objeto aunque se pida arrayRowMode.
          const values = Array.isArray(row) ? row : Object.values(row ?? {});
          current.rows.push(values.map((value) => normalizeCell(value, this.limits.maxCellChars)));
          current.rowCount = current.rows.length;
          return;
        }
        current.truncated = true;
        if (cancelWhenFull && !cancelled) {
          cancelled = true;
          request.cancel();
        }
      });

      request.on("rowsaffected", (count: number) => {
        rowsAffected += count;
      });

      request.on("error", (err: Error) => {
        // La cancelación propia llega como error "Canceled."; no es un fallo.
        if (cancelled) return;
        if (!errors.includes(err.message)) errors.push(err.message);
      });

      request.on("done", () => {
        if (errors.length) {
          reject(new SqlServerSqlError(query, errors.join(" | ")));
        } else {
          resolve({ tables, rowsAffected });
        }
      });

      // Con callback, mssql no crea una Promise interna (evita rechazos sin manejar).
      request.query(query, () => {});
    });
  }
}
