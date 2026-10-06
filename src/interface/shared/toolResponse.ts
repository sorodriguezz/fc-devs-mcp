import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { config } from "../../infrastructure/config/env.js";
import { jsonSafeReplacer } from "../../core/sql/sqlUtils.js";

/**
 * Último seguro contra respuestas gigantes: todo lo que devuelve una tool se
 * inyecta completo en el contexto del modelo.
 */
export function capText(text: string, maxChars = config.output.maxResponseChars): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;
  return (
    `${text.slice(0, maxChars)}\n…[respuesta truncada: se omitieron ${text.length - maxChars} caracteres. ` +
    `Acota la consulta (filtros, columnas, maxRows) para ver el resto.]`
  );
}

/** JSON compacto (sin indentación: la indentación son tokens que el modelo no necesita). */
export function toText(data: unknown): string {
  const text = typeof data === "string" ? data : (JSON.stringify(data, jsonSafeReplacer) ?? "null");
  return capText(text);
}

export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: toText(data) }] };
}

export function fail(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text", text: `Error: ${message}` }] };
}

/** Envuelve la lógica de una tool: serializa el resultado y convierte excepciones en `isError`. */
export function toolHandler<A>(fn: (args: A) => Promise<unknown>): (args: A) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return fail(err);
    }
  };
}
