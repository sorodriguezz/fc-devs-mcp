import sql from "mssql";

import type {
  ISqlServerRepository,
  SqlServerExecutionResult,
  SqlMutationResult,
  SqlMutationType,
  SqlSelectResult,
} from "../../core/interfaces/ISqlServerRepository.js";
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

type KnownSqlOperation = "SELECT" | SqlMutationType;

const KNOWN_SQL_VERBS: ReadonlySet<string> = new Set([
  "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "CREATE", "ALTER",
]);

function classifySqlOperation(query: string): KnownSqlOperation {
  const firstToken = query.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
  return KNOWN_SQL_VERBS.has(firstToken) ? (firstToken as KnownSqlOperation) : "DML";
}

export class SqlServerRepository implements ISqlServerRepository {
  constructor(private readonly conn: SqlServerConnectionManager) {}

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

    let sqlResult: sql.IResult<unknown>;
    try {
      const request = pool.request();
      if (maxRows !== undefined && maxRows > 0) {
        sqlResult = await request.query(`SET ROWCOUNT ${maxRows}; ${trimmedQuery}`);
      } else {
        sqlResult = await request.query(trimmedQuery);
      }
    } catch (err: any) {
      throw new SqlServerSqlError(trimmedQuery, err.message ?? "Error desconocido.");
    }

    if (operation === "SELECT") {
      return this.buildSelectResult(sqlResult);
    }
    return this.buildMutationResult(operation, sqlResult);
  }

  async close(): Promise<void> {}

  private buildSelectResult(result: sql.IResult<unknown>): SqlSelectResult {
    const rows = (result.recordset ?? []) as Array<Record<string, unknown>>;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      operation: "SELECT",
      columns,
      rows,
      rowCount: rows.length,
    };
  }

  private buildMutationResult(
    operation: KnownSqlOperation,
    result: sql.IResult<unknown>,
  ): SqlMutationResult {
    const rowsAffected = (result.rowsAffected ?? []).reduce((a, b) => a + b, 0);
    const mutationType: SqlMutationType = operation === "SELECT" ? "DML" : operation;

    return {
      operation: mutationType,
      success: true,
      rowsAffected,
      message: `Operación ${mutationType} ejecutada correctamente. Filas afectadas: ${rowsAffected}.`,
    };
  }
}
