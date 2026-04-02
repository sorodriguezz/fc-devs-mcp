import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { mssqlInputSchema } from "../schemas/mssql-query.schema.js";
import type { ExecSqlServerUseCase } from "../../../core/use-cases/mssql/ExecSqlServerUseCase.js";

export const registerSqlServerTools = (
  server: McpServer,
  useCase: ExecSqlServerUseCase,
): void => {
  server.registerTool(
    "mssql_query",
    {
      title: "Consulta SQL a Microsoft SQL Server",
      description:
        "Ejecuta una consulta SQL (SELECT, INSERT, UPDATE, DELETE, DDL) en la base de datos Microsoft SQL Server conectada.",
      inputSchema: mssqlInputSchema,
    },
    async (args) => {
      try {
        const results = await useCase.execute(args.query, args.maxRows);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${err.message}` }],
        };
      }
    },
  );
};
