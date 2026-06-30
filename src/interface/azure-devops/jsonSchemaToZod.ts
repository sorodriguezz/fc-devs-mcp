import { z } from "zod";

/**
 * Subconjunto de JSON Schema que exponen las tools del MCP oficial de Azure DevOps.
 */
interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: unknown[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
}

/**
 * Si el valor es un string que "parece" JSON (array u objeto), lo parsea.
 * Esto repara el caso en que el cliente/transporte serializa los parámetros
 * tipo `array`/`object` a texto antes de llegar a este proxy, lo que provoca
 * el error `expected array, received string` en el MCP oficial de Azure DevOps.
 */
export function parseIfJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const looksLikeJson =
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"));
  if (!looksLikeJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function coerceNumber(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

function coerceBoolean(value: unknown): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function pickType(schema: JsonSchema): string | undefined {
  return Array.isArray(schema.type) ? schema.type[0] : schema.type;
}

/**
 * Convierte un nodo JSON Schema en un tipo Zod. Es deliberadamente *permisivo*:
 * ante cualquier construcción no reconocida cae a `z.unknown()` (acepta todo),
 * de modo que el proxy nunca sea MÁS estricto que el MCP oficial. La validación
 * fuerte la sigue haciendo Azure DevOps; aquí solo añadimos tipos + coerción.
 */
export function schemaToZodType(schema: JsonSchema | undefined): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.unknown();

  // Uniones / enums: mantener laxo pero válido.
  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf) || Array.isArray(schema.enum)) {
    return z.preprocess(parseIfJsonString, z.any());
  }

  switch (pickType(schema)) {
    case "string":
      return z.string();

    case "integer":
    case "number":
      return z.preprocess(coerceNumber, z.number());

    case "boolean":
      return z.preprocess(coerceBoolean, z.boolean());

    case "array": {
      const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      return z.preprocess(parseIfJsonString, z.array(schemaToZodType(itemSchema)));
    }

    case "object":
      // Objeto laxo: acepta cualquier registro tras parsear strings JSON.
      return z.preprocess(parseIfJsonString, z.record(z.string(), z.unknown()));

    default:
      // Sin tipo declarado: parsear JSON si viene como string, aceptar lo demás.
      return z.preprocess(parseIfJsonString, z.unknown());
  }
}

/**
 * Construye un ZodRawShape (objeto de tipos Zod por propiedad) a partir del
 * `inputSchema` JSON de una tool upstream. Las propiedades no requeridas quedan
 * `.optional()`. Si el schema no es un objeto con `properties`, devuelve `{}`.
 */
export function buildInputShape(inputSchema: unknown): z.ZodRawShape {
  const schema = inputSchema as JsonSchema | undefined;
  if (!schema || pickType(schema) !== "object" || !schema.properties) {
    return {};
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let zodType = schemaToZodType(propSchema);
    if (!required.has(key)) {
      zodType = zodType.optional();
    }
    shape[key] = zodType;
  }

  return shape;
}

/**
 * Normalización defensiva aplicada en el handler antes de reenviar al MCP
 * oficial. Recorre los argumentos y, para cada propiedad que el schema upstream
 * declara como `array` u `object`, parsea el string JSON si aún llegara así.
 * Es una red de seguridad redundante con la coerción del schema.
 */
export function normalizeArgs(
  args: Record<string, unknown>,
  inputSchema: unknown,
): Record<string, unknown> {
  const schema = inputSchema as JsonSchema | undefined;
  if (!schema || !schema.properties) return args;

  const result: Record<string, unknown> = { ...args };
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (!(key in result)) continue;
    const type = pickType(propSchema);
    if (type === "array" || type === "object") {
      result[key] = parseIfJsonString(result[key]);
    }
  }
  return result;
}
