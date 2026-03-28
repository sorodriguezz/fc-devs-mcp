import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ProductionUseCase } from "../../../core/use-cases/iris-intersystem/productions/ProductionUseCase.js";
import {
  createProductionSchema,
  startProductionSchema,
  stopProductionSchema,
  getHostsSchema,
} from "../schemas/iris-production.schema.js";

function toText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function registerIrisProductionTools(
  server: McpServer,
  useCase: ProductionUseCase,
): void {
  server.registerTool(
    "iris_production_status",
    {
      title: "Estado de la Production activa",
      description:
        "Retorna el nombre y estado de la Production de InterSystems IRIS actualmente en ejecución. " +
        "Estados posibles: Running, Stopped, Suspended, Troubled, Unknown.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.getStatus();
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_list",
    {
      title: "Listar Productions",
      description:
        "Lista todas las Productions configuradas en el namespace actual de IRIS, " +
        "con nombre y descripción.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.listProductions();
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_create",
    {
      title: "Crear Production",
      description:
        "Crea una nueva Production en IRIS con el nombre especificado y una descripción opcional. " +
        "Falla si ya existe una Production con el mismo nombre.",
      inputSchema: createProductionSchema,
    },
    async (args) => {
      try {
        const result = await useCase.createProduction(args.name, args.description);
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_start",
    {
      title: "Iniciar Production",
      description: "Inicia una Production de IRIS especificada por nombre.",
      inputSchema: startProductionSchema,
    },
    async (args) => {
      try {
        const result = await useCase.startProduction(args.name);
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_stop",
    {
      title: "Detener Production",
      description:
        "Detiene la Production actualmente activa en IRIS. " +
        "Se puede especificar el timeout en segundos antes de forzar el stop.",
      inputSchema: stopProductionSchema,
    },
    async (args) => {
      try {
        const result = await useCase.stopProduction(args.timeoutSeconds);
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_restart",
    {
      title: "Reiniciar Production",
      description:
        "Reinicia la Production activa de IRIS (equivalente a UpdateProduction). " +
        "Recarga configuración sin necesidad de stop+start completo.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.restartProduction();
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_hosts",
    {
      title: "Hosts de una Production",
      description:
        "Lista todos los Business Services, Business Processes y Business Operations " +
        "de una Production de IRIS, con su tipo, pool size y estado habilitado.",
      inputSchema: getHostsSchema,
    },
    async (args) => {
      try {
        const result = await useCase.getHosts(args.productionName);
        return { content: [{ type: "text", text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Error: ${err.message}` }] };
      }
    },
  );
}
