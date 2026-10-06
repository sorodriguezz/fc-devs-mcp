import * as iris from "@intersystems/intersystems-iris-native";

import { normalizeCell } from "../../core/sql/sqlUtils.js";

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

/**
 * Ejecuta la sentencia vía `%SYSTEM.SQL.Execute` y devuelve el
 * `%SQL.StatementResult`. Lanza {@link IrisSqlError} si SQLCODE < 0.
 */
export function executeStatement(instance: any, query: string): any {
  const result = instance.classMethodObject("%SYSTEM.SQL", "Execute", query);
  if (result === null || result === undefined) {
    throw new Error("IRIS devolvió un resultado nulo. La sentencia puede ser inválida.");
  }

  const { sqlCode, sqlMessage } = readSqlState(result);
  if (sqlCode < 0) throw new IrisSqlError(sqlCode, sqlMessage, query);
  return result;
}

function readSqlState(result: any): { sqlCode: number; sqlMessage: string } {
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

/**
 * Separa `ROW(ID INTEGER, Price NUMERIC(10,2), "Mi Col" VARCHAR(5))` en
 * nombres de columna. Solo corta en comas de primer nivel: un split ingenuo
 * por `,` rompe con tipos como NUMERIC(10,2).
 */
export function parseRowTypeColumns(rowType: string): string[] {
  const inner = rowType.trim().replace(/^ROW\s*\(/i, "").replace(/\)\s*$/, "");
  const chunks: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let current = "";

  for (const ch of inner) {
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        chunks.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  chunks.push(current);

  return chunks
    .map((chunk) => {
      const text = chunk.trim();
      const quoted = text.match(/^"((?:[^"]|"")*)"/);
      return quoted ? quoted[1].replace(/""/g, '"') : (text.split(/\s+/)[0] ?? "");
    })
    .filter(Boolean);
}

/** Nombres de columna del result set (vacío si la sentencia no devuelve filas). */
export function readColumns(result: any): string[] {
  try {
    const metadata = result.invokeObject("%GetMetadata");
    if (!metadata) return [];
    const rowType = metadata.invokeString("GenerateRowType");
    return rowType ? parseRowTypeColumns(rowType) : [];
  } catch {
    return [];
  }
}

type RowFetcher = () => unknown[] | null;

/**
 * `%GetRow` trae la fila completa como $List en UN viaje de red. El método
 * anterior (`%Next` + `%Get` por columna) hacía 1 + N viajes por fila: 100
 * filas × 10 columnas ≈ 1.100 round-trips, lo que sobre VPN se nota en
 * segundos. Si la versión de IRIS no expone `%GetRow`, se recuerda y se usa
 * el camino por celda.
 */
let getRowSupported: boolean | undefined;

function getRowFetcher(result: any): RowFetcher {
  return () => {
    const ref = new iris.IRISReference(null);
    if (!result.invokeBoolean("%GetRow", ref)) return null;
    const list = ref.getIRISList();
    const values: unknown[] = [];
    const count = list?.count() ?? 0;
    for (let i = 1; i <= count; i++) values.push(list.get(i));
    return values;
  };
}

function perCellFetcher(result: any, columns: readonly string[]): RowFetcher {
  return () => {
    if (!result.invokeBoolean("%Next")) return null;
    return columns.map((col) => {
      try {
        return result.invokeString("%Get", col) ?? null;
      } catch {
        return null;
      }
    });
  };
}

function firstRow(result: any, columns: readonly string[]): { row: unknown[] | null; next: RowFetcher } {
  if (getRowSupported !== false) {
    const fetcher = getRowFetcher(result);
    try {
      const row = fetcher();
      getRowSupported = true;
      return { row, next: fetcher };
    } catch (err: any) {
      if (getRowSupported === true) throw err;
      getRowSupported = false;
      console.error(
        `⚠️  [IRIS] %GetRow no disponible (${err?.message}); se usará lectura por celda (más lenta).`,
      );
    }
  }
  const fetcher = perCellFetcher(result, columns);
  return { row: fetcher(), next: fetcher };
}

/**
 * Lee hasta `limit` filas. Para saber si hubo truncamiento lee una fila extra
 * (un solo viaje adicional) en lugar de recorrer el resto del cursor.
 */
export function readRows(
  result: any,
  columns: readonly string[],
  limit: number,
  maxCellChars: number,
): { rows: unknown[][]; truncated: boolean } {
  const rows: unknown[][] = [];
  let { row, next } = firstRow(result, columns);

  while (row !== null) {
    if (rows.length >= limit) return { rows, truncated: true };
    rows.push(row.map((value) => normalizeCell(value, maxCellChars)));
    row = next();
  }
  return { rows, truncated: false };
}
