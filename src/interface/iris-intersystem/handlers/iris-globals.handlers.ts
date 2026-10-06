import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { GlobalsUseCase } from "../../../core/use-cases/iris-intersystem/globals/GlobalsUseCase.js";
import {
  globalExistsSchema,
  globalGetSchema,
  globalIncrementSchema,
  globalKillSchema,
  globalListSchema,
  globalSetSchema,
} from "../schemas/iris-globals.schema.js";
import { toolHandler } from "../../shared/toolResponse.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerIrisGlobalsTools(server: McpServer, useCase: GlobalsUseCase): void {
  server.registerTool(
    "iris_global_get",
    {
      title: "Leer nodo de Global",
      description: "Devuelve el valor de un nodo de un global de IRIS (null si no tiene valor).",
      inputSchema: globalGetSchema,
      annotations: READ_ONLY,
    },
    toolHandler(async (args) => ({ value: await useCase.get(args.globalName, args.subscripts) })),
  );

  server.registerTool(
    "iris_global_set",
    {
      title: "Escribir nodo de Global",
      description: "Guarda un valor en un nodo de un global de IRIS (lo crea o lo reemplaza).",
      inputSchema: globalSetSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    toolHandler(async (args) => {
      await useCase.set(args.globalName, args.value, args.subscripts);
      return { success: true, node: `^${buildAddress(args.globalName, args.subscripts)}` };
    }),
  );

  server.registerTool(
    "iris_global_kill",
    {
      title: "Eliminar nodo de Global",
      description:
        "Elimina un nodo de un global de IRIS y todos sus subnodos. Sin subscripts elimina el global completo.",
      inputSchema: globalKillSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    toolHandler(async (args) => {
      await useCase.kill(args.globalName, args.subscripts);
      return { success: true, killed: `^${buildAddress(args.globalName, args.subscripts)}` };
    }),
  );

  server.registerTool(
    "iris_global_exists",
    {
      title: "Verificar existencia de nodo Global",
      description:
        "Indica si un nodo de un global existe. state: 0=no existe, 1=valor, 10=hijos, 11=valor e hijos.",
      inputSchema: globalExistsSchema,
      annotations: READ_ONLY,
    },
    toolHandler((args) => useCase.exists(args.globalName, args.subscripts)),
  );

  server.registerTool(
    "iris_global_list",
    {
      title: "Listar nodos hijos de un Global",
      description: "Lista los hijos directos de un nodo de un global. Soporta orden inverso, inicio y límite.",
      inputSchema: globalListSchema,
      annotations: READ_ONLY,
    },
    toolHandler((args) =>
      useCase.list(args.globalName, args.subscripts, {
        reversed: args.reversed,
        startFrom: args.startFrom,
        maxItems: args.maxItems,
      }),
    ),
  );

  server.registerTool(
    "iris_global_increment",
    {
      title: "Incrementar contador en Global",
      description: "Suma atómicamente delta (default 1) a un nodo numérico; si no existe parte de 0.",
      inputSchema: globalIncrementSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    toolHandler(async (args) => ({
      newValue: await useCase.increment(args.globalName, args.subscripts, args.delta),
    })),
  );
}

function buildAddress(globalName: string, subscripts?: string[]): string {
  if (!subscripts?.length) return globalName;
  return `${globalName}(${subscripts.map((s) => `"${s}"`).join(", ")})`;
}
