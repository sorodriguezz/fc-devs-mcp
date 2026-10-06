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
import { toolHandler } from "../../shared/toolResponse.js";

const NO_ARGS = z.object({});
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const MUTATING = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DISRUPTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

export function registerIrisProductionTools(
  server: McpServer,
  useCase: ProductionUseCase,
): void {
  server.registerTool(
    "iris_production_status",
    {
      title: "Estado de la Production activa",
      description:
        "Nombre y estado de la Production activa de IRIS (Running, Stopped, Suspended, Troubled, Unknown).",
      inputSchema: NO_ARGS,
      annotations: READ_ONLY,
    },
    toolHandler(() => useCase.getStatus()),
  );

  server.registerTool(
    "iris_production_list",
    {
      title: "Listar Productions",
      description: "Lista las Productions del namespace de IRIS con su descripción.",
      inputSchema: NO_ARGS,
      annotations: READ_ONLY,
    },
    toolHandler(() => useCase.listProductions()),
  );

  server.registerTool(
    "iris_production_create",
    {
      title: "Crear Production",
      description: "Crea una Production nueva en IRIS. Falla si el nombre ya existe.",
      inputSchema: createProductionSchema,
      annotations: MUTATING,
    },
    toolHandler((args) => useCase.createProduction(args.name, args.description)),
  );

  server.registerTool(
    "iris_production_start",
    {
      title: "Iniciar Production",
      description: "Inicia una Production de IRIS por nombre.",
      inputSchema: startProductionSchema,
      annotations: MUTATING,
    },
    toolHandler((args) => useCase.startProduction(args.name)),
  );

  server.registerTool(
    "iris_production_stop",
    {
      title: "Detener Production",
      description: "Detiene la Production activa de IRIS.",
      inputSchema: stopProductionSchema,
      annotations: DISRUPTIVE,
    },
    toolHandler((args) => useCase.stopProduction(args.timeout, args.force)),
  );

  server.registerTool(
    "iris_production_restart",
    {
      title: "Reiniciar Production",
      description:
        "Reinicia (stop + start) la Production activa. Para solo recargar configuración usar interoperability_production_update.",
      inputSchema: NO_ARGS,
      annotations: DISRUPTIVE,
    },
    toolHandler(() => useCase.restartProduction()),
  );

  server.registerTool(
    "iris_production_hosts",
    {
      title: "Hosts de una Production",
      description: "Lista los Business Services/Processes/Operations de una Production con clase, pool size y enabled.",
      inputSchema: getHostsSchema,
      annotations: READ_ONLY,
    },
    toolHandler((args) => useCase.getHosts(args.productionName)),
  );

  server.registerTool(
    "interoperability_production_queues",
    {
      title: "Colas de mensajes de la Production",
      description: "Lista las colas de mensajes de la Production con su cantidad de mensajes pendientes.",
      inputSchema: NO_ARGS,
      annotations: READ_ONLY,
    },
    toolHandler(() => useCase.getQueues()),
  );

  server.registerTool(
    "interoperability_production_logs",
    {
      title: "Logs del Event Log de IRIS",
      description:
        "Últimas entradas del Event Log (Ens_Util.Log), de la más reciente a la más antigua. " +
        "Filtrar por type/configName ahorra tokens.",
      inputSchema: getLogsSchema,
      annotations: READ_ONLY,
    },
    toolHandler((args) => useCase.getLogs(args)),
  );

  server.registerTool(
    "interoperability_production_update",
    {
      title: "Actualizar configuración de la Production",
      description: "Aplica en caliente los cambios de configuración pendientes de la Production activa (UpdateProduction).",
      inputSchema: NO_ARGS,
      annotations: MUTATING,
    },
    toolHandler(() => useCase.updateProduction()),
  );

  server.registerTool(
    "interoperability_production_needsupdate",
    {
      title: "Verificar si la Production necesita actualización",
      description: "Indica si la Production activa tiene cambios de configuración sin aplicar.",
      inputSchema: NO_ARGS,
      annotations: READ_ONLY,
    },
    toolHandler(async () => ({ needsUpdate: await useCase.productionNeedsUpdate() })),
  );

  server.registerTool(
    "interoperability_production_recover",
    {
      title: "Recuperar Production",
      description: "Recupera la Production cuando quedó en estado inconsistente o Troubled.",
      inputSchema: NO_ARGS,
      annotations: DISRUPTIVE,
    },
    toolHandler(() => useCase.recoverProduction()),
  );
}
