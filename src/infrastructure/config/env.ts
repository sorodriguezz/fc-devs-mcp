import "dotenv/config";
import env from "env-var";

import type { IIrisConfig } from "../iris-intersystem/IrisRepository.js";
import type { IAzureDevOpsConfig } from "../azure-devops/AzureDevOpsMcpClient.js";
import type { ISqlServerConfig } from "../mssql/SqlServerConnectionManager.js";

/** Convierte "a, b c" → ["a", "b", "c"] (acepta comas y/o espacios). */
function asList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export const IRIS_TOOLSETS = ["sql", "production", "globals"] as const;
export type IrisToolset = (typeof IRIS_TOOLSETS)[number];

export const config = {
  server: {
    name: env.get("MCP_SERVER_NAME").default("FC-MCP-Server").asString(),
    version: env.get("MCP_SERVER_VERSION").default("1.0.0").asString(),
  },

  /**
   * Límites de salida: todo lo que devuelve una tool termina en el contexto del
   * modelo, así que acotarlo es la forma más directa de ahorrar tokens.
   */
  output: {
    /** Filas por defecto en SELECT cuando la tool no recibe `maxRows`. */
    defaultMaxRows: env.get("SQL_MAX_ROWS").default("100").asIntPositive(),
    /** Largo máximo de cada celda/valor string antes de recortarlo (0 = sin límite). */
    maxCellChars: env.get("MCP_MAX_CELL_CHARS").default("500").asInt(),
    /** Tope de caracteres de la respuesta completa de una tool (0 = sin límite). */
    maxResponseChars: env.get("MCP_MAX_RESPONSE_CHARS").default("40000").asInt(),
  },

  iris: {
    enabled: env.get("IRIS_ENABLED").default("true").asBool(),
    hostname: env.get("IRIS_HOSTNAME").default("").asString(),
    port: env.get("IRIS_PORT").default("1972").asPortNumber(),
    namespace: env.get("IRIS_NAMESPACE").default("").asString(),
    username: env.get("IRIS_USERNAME").default("").asString(),
    password: env.get("IRIS_PASSWORD").default("").asString(),
    /** Grupos de tools a exponer. Desactivar los que no se usan ahorra contexto. */
    toolsets: asList(env.get("IRIS_TOOLSETS").default(IRIS_TOOLSETS.join(",")).asString()),
  } as IIrisConfig & { enabled: boolean; toolsets: string[] },

  mssql: {
    enabled: env.get("MSSQL_ENABLED").default("false").asBool(),
    hostname: env.get("MSSQL_HOSTNAME").default("").asString(),
    port: env.get("MSSQL_PORT").default("1433").asPortNumber(),
    database: env.get("MSSQL_DATABASE").default("").asString(),
    username: env.get("MSSQL_USERNAME").default("").asString(),
    password: env.get("MSSQL_PASSWORD").default("").asString(),
    encrypt: env.get("MSSQL_ENCRYPT").default("true").asBool(),
    trustServerCertificate: env.get("MSSQL_TRUST_SERVER_CERT").default("false").asBool(),
    authType: env
      .get("MSSQL_AUTH")
      .default("sql")
      .asEnum(["sql", "azure-ad-password"]),
    azureClientId: env.get("MSSQL_AZURE_CLIENT_ID").default("").asString(),
    azureTenantId: env.get("MSSQL_AZURE_TENANT_ID").default("").asString(),
  } as ISqlServerConfig & { enabled: boolean },

  ado: {
    enabled: env.get("ADO_ENABLED").default("false").asBool(),
    orgUrl: env.get("AZURE_DEVOPS_ORG_URL").default("").asString(),
    pat: env.get("AZURE_DEVOPS_PAT").default("").asString(),
    /**
     * Dominios del MCP oficial a cargar (core, work, work-items, repositories,
     * pipelines, wiki, test-plans, search, advanced-security). Vacío = todos.
     */
    domains: asList(env.get("ADO_DOMAINS").default("").asString()),
    /** Allowlist de tools por nombre; admite comodín final (ej. `wit_*`). Vacío = todas. */
    tools: asList(env.get("ADO_TOOLS").default("").asString()),
    /**
     * Largo máximo de la descripción de cada parámetro (0 = omitirlas, -1 = completas).
     * Las de parámetros enum (p. ej. `action`) se conservan siempre.
     */
    paramDescMaxChars: env.get("ADO_PARAM_DESC_MAX_CHARS").default("0").asInt(),
    /** Quitar metadatos REST (_links, urls de API, avatares, nulls) de las respuestas. */
    compactResponses: env.get("ADO_COMPACT_RESPONSES").default("true").asBool(),
  } as IAzureDevOpsConfig & { enabled: boolean },
};
