import "dotenv/config";
import env from "env-var";

import type { IIrisConfig } from "../iris-intersystem/IrisRepository.js";
import type { IAzureDevOpsConfig } from "../azure-devops/AzureDevOpsMcpClient.js";

export const config = {
  server: {
    name: env.get("MCP_SERVER_NAME").default("FC-MCP-Server").asString(),
    version: env.get("MCP_SERVER_VERSION").default("1.0.0").asString(),
  },

  iris: {
    hostname: env.get("IRIS_HOSTNAME").required().asString(),
    port: env.get("IRIS_PORT").required().asPortNumber(),
    namespace: env.get("IRIS_NAMESPACE").required().asString(),
    username: env.get("IRIS_USERNAME").required().asString(),
    password: env.get("IRIS_PASSWORD").required().asString(),
  } as IIrisConfig,
  ado: {
    enabled: env.get("ADO_ENABLED").default("false").asBool(),
    orgUrl: env.get("AZURE_DEVOPS_ORG_URL").default("").asString(),
    pat: env.get("AZURE_DEVOPS_PAT").default("").asString(),
  } as IAzureDevOpsConfig & { enabled: boolean },
};
