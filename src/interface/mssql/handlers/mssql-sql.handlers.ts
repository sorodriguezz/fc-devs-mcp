import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { mssqlInputSchema } from "../schemas/mssql-query.schema.js";
import { toolHandler } from "../../shared/toolResponse.js";
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
        "Ejecuta T-SQL (SELECT, DML, DDL) en SQL Server. Los SELECT devuelven {columns, rows} con filas como arrays.",
      inputSchema: mssqlInputSchema,
    },
    toolHandler((args) => useCase.execute(args.query, args.maxRows)),
  );
};
