export type SqlMutationType =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "DROP"
  | "TRUNCATE"
  | "CREATE"
  | "ALTER"
  | "DML";

/**
 * Resultado tabular en formato columnar: los nombres de columna van una sola
 * vez y cada fila es un array posicional. Frente a un array de objetos
 * (`[{col: valor}, …]`) evita repetir los nombres en cada fila, que es lo que
 * más tokens consume en resultados con muchas filas.
 */
export interface SqlTable {
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<readonly unknown[]>;
  readonly rowCount: number;
  /** Presente solo si había más filas que el límite aplicado. */
  readonly truncated?: true;
}

export interface SqlSelectResult extends SqlTable {
  readonly operation: "SELECT";
  /** Result sets adicionales (lotes con varias sentencias SELECT). */
  readonly moreResults?: readonly SqlTable[];
}

export interface SqlMutationResult {
  readonly operation: SqlMutationType;
  readonly rowsAffected: number;
}

export type SqlExecutionResult = SqlSelectResult | SqlMutationResult;

/** Límites que acotan cuánto de un resultado llega al modelo. */
export interface OutputLimits {
  /** Filas a devolver cuando la llamada no especifica `maxRows`. */
  readonly defaultMaxRows: number;
  /** Largo máximo de cada celda string (<= 0 = sin límite). */
  readonly maxCellChars: number;
}
