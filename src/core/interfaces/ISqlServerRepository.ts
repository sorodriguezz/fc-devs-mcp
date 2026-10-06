import type { SqlExecutionResult } from "../sql/SqlResult.js";

export type {
  SqlMutationResult,
  SqlMutationType,
  SqlSelectResult,
  SqlTable,
} from "../sql/SqlResult.js";

export type SqlServerExecutionResult = SqlExecutionResult;

export interface ISqlServerRepository {
  executeSql(query: string, maxRows?: number): Promise<SqlServerExecutionResult>;
  close(): Promise<void>;
}
