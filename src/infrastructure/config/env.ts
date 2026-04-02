import "dotenv/config";
import env from "env-var";

import type { IIrisConfig } from "../iris-intersystem/IrisRepository.js";
import type { IAzureDevOpsConfig } from "../azure-devops/AzureDevOpsMcpClient.js";
import type { ISqlServerConfig } from "../mssql/SqlServerConnectionManager.js";

export const config = {
  server: {
    name: env.get("MCP_SERVER_NAME").default("FC-MCP-Server").asString(),
    version: env.get("MCP_SERVER_VERSION").default("1.0.0").asString(),
  },

  iris: {
    enabled: env.get("IRIS_ENABLED").default("true").asBool(),
    hostname: env.get("IRIS_HOSTNAME").default("").asString(),
    port: env.get("IRIS_PORT").default("1972").asPortNumber(),
    namespace: env.get("IRIS_NAMESPACE").default("").asString(),
    username: env.get("IRIS_USERNAME").default("").asString(),
    password: env.get("IRIS_PASSWORD").default("").asString(),
  } as IIrisConfig & { enabled: boolean },

  mssql: {
    enabled: env.get("MSSQL_ENABLED").default("false").asBool(),
    hostname: env.get("MSSQL_HOSTNAME").default("").asString(),
    port: env.get("MSSQL_PORT").default("1433").asPortNumber(),
    database: env.get("MSSQL_DATABASE").default("").asString(),
    username: env.get("MSSQL_USERNAME").default("").asString(),
    password: env.get("MSSQL_PASSWORD").default("").asString(),
    encrypt: env.get("MSSQL_ENCRYPT").default("true").asBool(),
    trustServerCertificate: env.get("MSSQL_TRUST_SERVER_CERT").default("false").asBool(),
  } as ISqlServerConfig & { enabled: boolean },

  ado: {
    enabled: env.get("ADO_ENABLED").default("false").asBool(),
    orgUrl: env.get("AZURE_DEVOPS_ORG_URL").default("").asString(),
    pat: env.get("AZURE_DEVOPS_PAT").default("").asString(),
  } as IAzureDevOpsConfig & { enabled: boolean },
};
