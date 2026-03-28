import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ProductionUseCase } from "../../../core/use-cases/iris-intersystem/productions/ProductionUseCase.js";
import {
  createProductionSchema,
  getHostsSchema,
  getLogsSchema,
  startProductionSchema,
  stopProductionSchema,
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
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
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
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
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
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
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
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
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
    async () => {
      try {
        const result = await useCase.stopProduction();
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "iris_production_restart",
    {
      title: "Reiniciar Production",
      description:
        "Reinicia la Production activa de IRIS con un ciclo completo de stop + start. " +
        "Usar iris_production_update para recargar configuración sin detenerla.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.restartProduction();
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
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
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "interoperability_production_queues",
    {
      title: "Colas de mensajes de la Production",
      description:
        "Lista todas las colas de mensajes activas en la Production de IRIS con " +
        "su nombre y cantidad de mensajes pendientes.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.getQueues();
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "interoperability_production_logs",
    {
      title: "Logs del Event Log de IRIS",
      description:
        "Retorna las últimas entradas del Event Log de la Production (Ens_Util.Log), " +
        "ordenadas del más reciente al más antiguo. Soporta límite configurable.",
      inputSchema: getLogsSchema,
    },
    async (args) => {
      try {
        const result = await useCase.getLogs(args.maxRows);
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "interoperability_production_update",
    {
      title: "Actualizar configuración de la Production",
      description:
        "Aplica los cambios de configuración pendientes a la Production activa de IRIS " +
        "sin necesidad de detenerla (hot reload). Equivalente a UpdateProduction en Ens.Director.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.updateProduction();
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "interoperability_production_needsupdate",
    {
      title: "Verificar si la Production necesita actualización",
      description:
        "Verifica si la configuración de la Production activa de IRIS ha sido modificada " +
        "y requiere un UpdateProduction para aplicar los cambios.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const needsUpdate = await useCase.productionNeedsUpdate();
        return {
          content: [{ type: "text" as const, text: toText({ needsUpdate }) }],
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );

  server.registerTool(
    "interoperability_production_recover",
    {
      title: "Recuperar Production",
      description:
        "Ejecuta una recuperación de la Production de IRIS para restablecer su estado " +
        "cuando se encuentra en un estado inconsistente o Troubled.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await useCase.recoverProduction();
        return { content: [{ type: "text" as const, text: toText(result) }] };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
      }
    },
  );
}
