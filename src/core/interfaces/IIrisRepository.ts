export type SqlMutationType =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "DROP"
  | "TRUNCATE"
  | "CREATE"
  | "ALTER"
  | "DML";

export interface SqlSelectResult {
  readonly operation: "SELECT";
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly rowCount: number;
}

export interface SqlMutationResult {
  readonly operation: SqlMutationType;
  readonly success: true;
  readonly rowsAffected: number;
  readonly message: string;
}

export type SqlExecutionResult = SqlSelectResult | SqlMutationResult;

export interface IIrisRepository {
  executeSql(query: string, maxRows?: number): Promise<SqlExecutionResult>;
  close(): Promise<void>;
}
