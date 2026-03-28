import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "./infrastructure/config/env.js";

import { IrisRepository } from "./infrastructure/iris-intersystem/IrisRepository.js";
import { ExecSQLUseCase } from "./core/use-cases/iris-intersystem/ExecSQL.js";
import { registerIrisSQLTools } from "./interface/iris-intersystem/handlers/iris-sql.handlers.js";

const server = new McpServer({
  name: config.server.name,
  version: config.server.version,
});

// REPOSITORIES
const irisRepo = new IrisRepository(config.iris);

// USE CASES
const queryUseCase = new ExecSQLUseCase(irisRepo);

// TOOLS
registerIrisSQLTools(server, queryUseCase);

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("🚀 MCP Server running");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
