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

function toText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function registerIrisGlobalsTools(server: McpServer, useCase: GlobalsUseCase): void {
  server.registerTool(
    "iris_global_get",
    {
      title: "Leer nodo de Global",
      description:
        "Retorna el valor almacenado en un nodo específico del global array de IRIS. " +
        "Retorna null si el nodo no tiene valor. Los subscripts definen la ruta al nodo.",
      inputSchema: globalGetSchema,
    },
    async (args) => {
      try {
        const value = await useCase.get(args.globalName, args.subscripts);
        return { content: [{ type: "text" as const, text: toText({ value }) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_global_set",
    {
      title: "Escribir nodo de Global",
      description:
        "Almacena un valor en un nodo del global array de IRIS. " +
        "Si el nodo no existe, se crea. Si ya existe, su valor es reemplazado.",
      inputSchema: globalSetSchema,
    },
    async (args) => {
      try {
        await useCase.set(args.globalName, args.value, args.subscripts);
        const address = buildAddress(args.globalName, args.subscripts);
        return {
          content: [{ type: "text" as const, text: toText({ success: true, message: `Valor almacenado en ^${address}.` }) }],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_global_kill",
    {
      title: "Eliminar nodo de Global",
      description:
        "Elimina un nodo del global array de IRIS junto con todos sus subnodos. " +
        "Si no se especifican subscripts, se elimina el global completo.",
      inputSchema: globalKillSchema,
    },
    async (args) => {
      try {
        await useCase.kill(args.globalName, args.subscripts);
        const address = buildAddress(args.globalName, args.subscripts);
        return {
          content: [{ type: "text" as const, text: toText({ success: true, message: `Nodo ^${address} y sus subnodos eliminados.` }) }],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_global_exists",
    {
      title: "Verificar existencia de nodo Global",
      description:
        "Verifica si un nodo del global array de IRIS existe y qué contiene. " +
        "state: 0=no existe, 1=tiene valor, 10=tiene hijos, 11=tiene valor e hijos.",
      inputSchema: globalExistsSchema,
    },
    async (args) => {
      try {
        const result = await useCase.exists(args.globalName, args.subscripts);
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_global_list",
    {
      title: "Listar nodos hijos de un Global",
      description:
        "Itera y retorna los nodos hijo directos de un nodo del global array de IRIS. " +
        "Soporta orden inverso, punto de inicio y límite de resultados.",
      inputSchema: globalListSchema,
    },
    async (args) => {
      try {
        const nodes = await useCase.list(args.globalName, args.subscripts, {
          reversed: args.reversed,
          startFrom: args.startFrom,
          maxItems: args.maxItems,
        });
        return { content: [{ type: "text" as const, text: toText(nodes) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_global_increment",
    {
      title: "Incrementar contador en Global",
      description:
        "Incrementa o decrementa atómicamente el valor numérico de un nodo del global array. " +
        "Si el nodo no existe, se inicializa en 0 antes de aplicar el delta.",
      inputSchema: globalIncrementSchema,
    },
    async (args) => {
      try {
        const newValue = await useCase.increment(args.globalName, args.subscripts, args.delta);
        return { content: [{ type: "text" as const, text: toText({ newValue }) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );
}

function buildAddress(globalName: string, subscripts?: string[]): string {
  if (!subscripts?.length) return globalName;
  return `${globalName}(${subscripts.map((s) => `"${s}"`).join(", ")})`;
}
