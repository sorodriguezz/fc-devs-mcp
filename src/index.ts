import { McpApplication } from "./server/McpApplication.js";

new McpApplication().start().catch((err: Error) => {
  console.error(`💥 [MCP] Error fatal al iniciar el servidor: ${err.message}`);
  process.exit(1);
});
