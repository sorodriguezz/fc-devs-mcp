import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { inputSchema } from "../schemas/iris-query.schema.js";

import type { ExecSQLUseCase } from "../../../core/use-cases/iris-intersystem/sql/ExecSQLUseCase.js";

export const registerIrisSQLTools = (
  server: McpServer,
  useCase: ExecSQLUseCase,
) => {
  server.registerTool(
    "iris_query",
    {
      title: "Consulta SQL a InterSystems IRIS",
      description:
        "Ejecuta una consulta SQL en la base de datos InterSystems IRIS.",
      inputSchema,
    },
    async (args) => {
      try {
        const results = await useCase.execute(args.query);
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

  // server.registerTool("", {} as any, async (args) => {
  //   return {
  //     content: [{ type: "text", text: ''}],
  //   };
  // });
};
