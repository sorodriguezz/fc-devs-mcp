import { z } from "zod";

/**
 * Subconjunto de JSON Schema que exponen las tools del MCP oficial de Azure DevOps.
 */
interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: unknown[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
}

export interface SchemaConversionOptions {
  /**
   * Largo máximo de la descripción de cada parámetro: 0 las omite, -1 las deja
   * completas. Las descripciones de parámetros son ~45% del tamaño de las
   * definiciones del MCP oficial, pero sin ellas el modelo no sabe qué
   * parámetro aplica a cada `action` y falla llamadas (que también cuestan).
   */
  readonly paramDescMaxChars: number;
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

function shortenDescription(text: string | undefined, maxChars: number): string | undefined {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean || maxChars === 0) return undefined;
  if (maxChars < 0 || clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}

function isStringEnum(values: unknown[] | undefined): values is [string, ...string[]] {
  return Array.isArray(values) && values.length > 0 && values.every((v) => typeof v === "string");
}

/**
 * Convierte un nodo JSON Schema en un tipo Zod. Es deliberadamente *permisivo*
 * en validación (objetos abiertos, uniones como `any`) para que el proxy nunca
 * sea MÁS estricto que el MCP oficial, pero conserva lo que el modelo necesita
 * para llamar bien a la tool: enums, estructura de objetos anidados y
 * descripciones (recortadas).
 */
export function schemaToZodType(
  schema: JsonSchema | undefined,
  options: SchemaConversionOptions,
): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.unknown();

  const type = buildType(schema, options);
  // Las tools oficiales son "por acción": la descripción del enum `action`
  // es la única documentación de qué hace cada opción y qué parámetros pide,
  // así que las descripciones de enums se conservan siempre.
  const maxChars = Array.isArray(schema.enum) ? -1 : options.paramDescMaxChars;
  const description = shortenDescription(schema.description, maxChars);
  return description ? type.describe(description) : type;
}

function buildType(schema: JsonSchema, options: SchemaConversionOptions): z.ZodTypeAny {
  if (isStringEnum(schema.enum)) {
    return z.enum(schema.enum);
  }

  // Uniones / enums no-string: mantener laxo pero válido.
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
      return z.preprocess(parseIfJsonString, z.array(schemaToZodType(itemSchema, options)));
    }

    case "object":
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        return z.preprocess(parseIfJsonString, z.looseObject(buildShape(schema, options)));
      }
      return z.preprocess(parseIfJsonString, z.record(z.string(), z.unknown()));

    default:
      // Sin tipo declarado: parsear JSON si viene como string, aceptar lo demás.
      return z.preprocess(parseIfJsonString, z.unknown());
  }
}

function buildShape(schema: JsonSchema, options: SchemaConversionOptions): z.ZodRawShape {
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const zodType = schemaToZodType(propSchema, options);
    shape[key] = required.has(key) ? zodType : zodType.optional();
  }

  return shape;
}

/**
 * Construye un ZodRawShape (objeto de tipos Zod por propiedad) a partir del
 * `inputSchema` JSON de una tool upstream. Las propiedades no requeridas quedan
 * `.optional()`. Si el schema no es un objeto con `properties`, devuelve `{}`.
 */
export function buildInputShape(inputSchema: unknown, options: SchemaConversionOptions): z.ZodRawShape {
  const schema = inputSchema as JsonSchema | undefined;
  if (!schema || pickType(schema) !== "object" || !schema.properties) {
    return {};
  }
  return buildShape(schema, options);
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
