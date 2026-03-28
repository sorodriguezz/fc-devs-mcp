import type {
  IIrisRepository,
  SqlExecutionResult,
  SqlMutationResult,
  SqlMutationType,
  SqlSelectResult,
} from "../../core/interfaces/IIrisRepository.js";
import type { IrisConnectionManager } from "./IrisConnectionManager.js";

export interface IIrisConfig {
  readonly hostname: string;
  readonly port: number;
  readonly namespace: string;
  readonly username: string;
  readonly password: string;
}

export class IrisSqlError extends Error {
  public override readonly name = "IrisSqlError";

  constructor(
    public readonly sqlCode: number,
    sqlMessage: string,
    public readonly query: string,
  ) {
    super(
      `[SQLCODE ${sqlCode}]: ${sqlMessage?.trim() || "Error de SQL sin mensaje descriptivo."}`,
    );
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

function parseRowTypeColumns(rowType: string): string[] {
  return rowType
    .replace(/^ROW\s*\(|\)\s*$/gi, "")
    .split(",")
    .map((chunk) => chunk.trim().split(/\s+/)[0]?.replace(/^"|"$/g, "") ?? "")
    .filter(Boolean);
}

export class IrisRepository implements IIrisRepository {
  constructor(private readonly conn: IrisConnectionManager) {}

  async executeSql(query: string, maxRows?: number): Promise<SqlExecutionResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Error("La consulta SQL no puede estar vacía.");

    const operation = classifySqlOperation(trimmedQuery);
    const instance = this.conn.getActiveInstance();

    console.error(
      `[IRIS:SQL:${operation}] ${trimmedQuery.length > 120 ? trimmedQuery.substring(0, 120) + "…" : trimmedQuery}`,
    );

    const result = this.executeOnIris(instance, trimmedQuery);
    const { sqlCode, sqlMessage } = this.readSqlState(result);

    if (sqlCode < 0) throw new IrisSqlError(sqlCode, sqlMessage, trimmedQuery);

    const columns = this.extractColumnNames(result);

    return columns.length > 0
      ? this.buildSelectResult(columns, result, maxRows)
      : this.buildMutationResult(operation, result);
  }

  async close(): Promise<void> {}

  private executeOnIris(instance: any, query: string): any {
    let result: any;
    try {
      result = instance.classMethodObject("%SYSTEM.SQL", "Execute", query);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error de comunicación con IRIS al ejecutar la query: ${err.message}`);
    }

    if (result === null || result === undefined) {
      throw new Error("IRIS devolvió un resultado nulo. La sentencia puede ser inválida.");
    }
    return result;
  }

  private readSqlState(result: any): { sqlCode: number; sqlMessage: string } {
    let rawCode: unknown;
    try {
      rawCode = result.get("%SQLCODE");
      if (rawCode === undefined || rawCode === null) {
        rawCode = result.invokeNumber("%SQLCODEGet");
      }
    } catch (err: any) {
      throw new Error(`Error interno: No se pudo leer el SQLCODE. Detalle: ${err.message}`);
    }

    if (rawCode === undefined || rawCode === null) {
      throw new Error("IRIS retornó SQLCODE nulo o indefinido.");
    }

    let sqlMessage = "";
    try {
      const rawMsg = result.get("%Message");
      sqlMessage = rawMsg != null ? String(rawMsg) : "";
    } catch {
      /* mensaje no disponible, no es crítico */
    }

    return { sqlCode: Number(rawCode), sqlMessage };
  }

  private extractColumnNames(result: any): string[] {
    try {
      const metadata = result.invokeObject("%GetMetadata");
      if (!metadata) return [];
      const rowType = metadata.invokeString("GenerateRowType");
      if (!rowType) return [];
      return parseRowTypeColumns(rowType);
    } catch {
      return [];
    }
  }

  private buildSelectResult(columns: string[], result: any, maxRows?: number): SqlSelectResult {
    const rows: Array<Record<string, unknown>> = [];
    const limit = maxRows !== undefined && maxRows > 0 ? maxRows : Infinity;

    while (result.invokeBoolean("%Next") && rows.length < limit) {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        try {
          row[col] = result.invokeString("%Get", col) ?? null;
        } catch {
          row[col] = null;
        }
      }
      rows.push(row);
    }

    return { operation: "SELECT", columns, rows, rowCount: rows.length };
  }

  private buildMutationResult(operation: KnownSqlOperation, result: any): SqlMutationResult {
    let rowsAffected = 0;
    try {
      const raw = result.get("%ROWCOUNT");
      if (raw !== undefined && raw !== null) rowsAffected = Number(raw);
    } catch { /* DDL no expone %ROWCOUNT */ }

    const mutationType: SqlMutationType = operation === "SELECT" ? "DML" : operation;
    return {
      operation: mutationType,
      success: true,
      rowsAffected,
      message: `Operación ${mutationType} ejecutada correctamente. Filas afectadas: ${rowsAffected}.`,
    };
  }
}
