import type { SqlExecutionResult } from "../sql/SqlResult.js";

export type {
  SqlExecutionResult,
  SqlMutationResult,
  SqlMutationType,
  SqlSelectResult,
  SqlTable,
} from "../sql/SqlResult.js";

export interface IIrisRepository {
  executeSql(query: string, maxRows?: number): Promise<SqlExecutionResult>;
  close(): Promise<void>;
}
