import type { SqlMutationType } from "./SqlResult.js";

export type KnownSqlOperation = "SELECT" | SqlMutationType;

const KNOWN_SQL_VERBS: ReadonlySet<string> = new Set([
  "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "CREATE", "ALTER",
]);

export function classifySqlOperation(query: string): KnownSqlOperation {
  const firstToken = query.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
  return KNOWN_SQL_VERBS.has(firstToken) ? (firstToken as KnownSqlOperation) : "DML";
}

export function toMutationType(operation: KnownSqlOperation): SqlMutationType {
  return operation === "SELECT" ? "DML" : operation;
}

/**
 * true si la consulta es una única sentencia de lectura (SELECT / WITH … SELECT).
 * Solo en ese caso es seguro cortar la ejecución al alcanzar el límite de filas:
 * en un lote con varias sentencias, cancelar podría dejar sin ejecutar un
 * INSERT/UPDATE posterior. Ante la duda (p. ej. `;` dentro de un literal)
 * devuelve false, que es la opción conservadora.
 */
export function isSingleReadStatement(query: string): boolean {
  const body = query.trim().replace(/;+\s*$/, "");
  return /^(SELECT|WITH)\b/i.test(body) && !body.includes(";");
}

/** Límite efectivo de filas: el pedido explícitamente o el default configurado. */
export function resolveRowLimit(maxRows: number | undefined, defaultMaxRows: number): number {
  return maxRows !== undefined && maxRows > 0 ? Math.floor(maxRows) : defaultMaxRows;
}

const BINARY_PREVIEW_BYTES = 32;

function truncateString(value: string, maxChars: number): string {
  if (maxChars <= 0 || value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…[+${value.length - maxChars} chars]`;
}

function binaryPreview(bytes: Uint8Array): string {
  const head = Buffer.from(bytes.subarray(0, BINARY_PREVIEW_BYTES)).toString("hex");
  return bytes.length > BINARY_PREVIEW_BYTES ? `0x${head}…[${bytes.length} bytes]` : `0x${head}`;
}

/**
 * Convierte un valor devuelto por un driver en algo JSON-serializable y
 * barato en tokens: recorta strings largos, resume binarios (un Buffer
 * serializado por defecto es `{"type":"Buffer","data":[…]}`, un byte por
 * número) y normaliza bigint/Date/decimales.
 */
export function normalizeCell(value: unknown, maxChars: number): unknown {
  if (value === null || value === undefined) return null;

  switch (typeof value) {
    case "string":
      // IRIS representa el string vacío de SQL como $c(0).
      return value === "\u0000" ? "" : truncateString(value, maxChars);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (value instanceof Uint8Array) return binaryPreview(value);

  // Decimales (decimal.js de IRIS, etc.): número si no pierde precisión.
  const text = typeof value === "object" && "toFixed" in value ? String(value) : undefined;
  if (text !== undefined) {
    const n = Number(text);
    return Number.isFinite(n) && String(n) === text ? n : text;
  }

  return truncateString(typeof value === "object" ? JSON.stringify(value) ?? "" : String(value), maxChars);
}

/**
 * Replacer para JSON.stringify que tolera tipos que de otro modo fallan
 * (bigint) o explotan en tokens (Buffer), sin recortar strings.
 */
export function jsonSafeReplacer(this: unknown, key: string, value: unknown): unknown {
  const raw = (this as Record<string, unknown>)?.[key];
  if (raw instanceof Uint8Array) return binaryPreview(raw);
  if (typeof value === "bigint") return normalizeCell(value, 0);
  return value;
}
