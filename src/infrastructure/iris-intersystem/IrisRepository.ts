import type {
  IIrisRepository,
  SqlExecutionResult,
  SqlMutationResult,
  SqlSelectResult,
} from "../../core/interfaces/IIrisRepository.js";
import type { OutputLimits } from "../../core/sql/SqlResult.js";
import {
  classifySqlOperation,
  resolveRowLimit,
  toMutationType,
  type KnownSqlOperation,
} from "../../core/sql/sqlUtils.js";
import type { IrisConnectionManager } from "./IrisConnectionManager.js";
import { executeStatement, IrisSqlError, readColumns, readRows } from "./irisSql.js";

export { IrisSqlError };

export interface IIrisConfig {
  readonly hostname: string;
  readonly port: number;
  readonly namespace: string;
  readonly username: string;
  readonly password: string;
}

export class IrisRepository implements IIrisRepository {
  constructor(
    private readonly conn: IrisConnectionManager,
    private readonly limits: OutputLimits,
  ) {}

  async executeSql(query: string, maxRows?: number): Promise<SqlExecutionResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Error("La consulta SQL no puede estar vacía.");

    const operation = classifySqlOperation(trimmedQuery);
    const instance = this.conn.getActiveInstance();

    console.error(
      `[IRIS:SQL:${operation}] ${trimmedQuery.length > 120 ? trimmedQuery.substring(0, 120) + "…" : trimmedQuery}`,
    );

    const result = this.executeOnIris(instance, trimmedQuery);
    const columns = readColumns(result);

    return columns.length > 0
      ? this.buildSelectResult(columns, result, resolveRowLimit(maxRows, this.limits.defaultMaxRows))
      : this.buildMutationResult(operation, result);
  }

  async close(): Promise<void> {}

  private executeOnIris(instance: any, query: string): any {
    try {
      return executeStatement(instance, query);
    } catch (err: any) {
      if (err instanceof IrisSqlError) throw err;
      this.conn.invalidate();
      throw new Error(`Error de comunicación con IRIS al ejecutar la query: ${err.message}`);
    }
  }

  private buildSelectResult(columns: string[], result: any, limit: number): SqlSelectResult {
    const { rows, truncated } = readRows(result, columns, limit, this.limits.maxCellChars);
    return {
      operation: "SELECT",
      columns,
      rows,
      rowCount: rows.length,
      ...(truncated ? { truncated: true as const } : {}),
    };
  }

  private buildMutationResult(operation: KnownSqlOperation, result: any): SqlMutationResult {
    let rowsAffected = 0;
    try {
      const raw = result.get("%ROWCOUNT");
      if (raw !== undefined && raw !== null) rowsAffected = Number(raw);
    } catch { /* DDL no expone %ROWCOUNT */ }

    return { operation: toMutationType(operation), rowsAffected };
  }
}
