import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { inputSchema } from "../schemas/iris-query.schema.js";
import { toolHandler } from "../../shared/toolResponse.js";

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
        "Ejecuta SQL en InterSystems IRIS. Los SELECT devuelven {columns, rows} con filas como arrays.",
      inputSchema,
    },
    toolHandler((args) => useCase.execute(args.query, args.maxRows)),
  );
};
