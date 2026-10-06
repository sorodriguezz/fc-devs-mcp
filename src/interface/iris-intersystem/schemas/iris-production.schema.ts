import { z } from "zod";

import { LOG_TYPES } from "../../../core/interfaces/IIrisProductionRepository.js";
import { maxRowsField } from "../../shared/schemas.js";

export const startProductionSchema = z.object({
  name: z.string().min(1, "El nombre de la production es requerido."),
});

export const stopProductionSchema = z.object({
  timeout: z.number().int().min(0).optional().describe("Segundos a esperar antes de forzar (default 10)."),
  force: z.boolean().optional().describe("Forzar el stop si no termina a tiempo."),
});

export const createProductionSchema = z.object({
  name: z.string().min(1, "El nombre de la production es requerido."),
  description: z.string().optional(),
});

export const getHostsSchema = z.object({
  productionName: z.string().min(1, "El nombre de la production es requerido."),
});

export const getLogsSchema = z.object({
  maxRows: maxRowsField,
  type: z.enum(LOG_TYPES).optional().describe("Filtrar por tipo de entrada."),
  configName: z.string().optional().describe("Filtrar por host (ConfigName)."),
});
