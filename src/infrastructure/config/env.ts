import "dotenv/config";
import env from 'env-var';

import type { IIrisConfig } from "../iris-intersystem/IrisRepository.js";

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
};
