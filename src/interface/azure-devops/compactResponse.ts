/**
 * Las respuestas del MCP oficial de Azure DevOps son el JSON crudo de la API
 * REST, indentado y con mucho metadato que al modelo no le sirve: `_links`
 * (hrefs de navegación), `url` que apuntan a `/_apis/`, avatares,
 * descriptores de identidad y campos en null. Una identidad
 * (`System.AssignedTo`, `createdBy`, …) puede pasar de ~600 a ~120 caracteres.
 */
const DROPPED_KEYS: ReadonlySet<string> = new Set([
  "_links",
  "imageUrl",
  "avatar",
  "descriptor",
  "subjectDescriptor",
]);

const REST_API_URL = /\/_apis\//i;

export function compactJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactJson);
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === null || child === undefined) continue;
    if (DROPPED_KEYS.has(key)) continue;
    if (key === "url" && typeof child === "string" && REST_API_URL.test(child)) continue;
    out[key] = compactJson(child);
  }
  return out;
}

/** Re-serializa sin indentación y sin ruido si el texto es JSON; si no, lo deja igual. */
export function compactText(text: string): string {
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return text;
  try {
    return JSON.stringify(compactJson(JSON.parse(trimmed)));
  } catch {
    return text;
  }
}
