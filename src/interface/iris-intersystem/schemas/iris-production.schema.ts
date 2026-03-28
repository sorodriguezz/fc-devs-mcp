import { z } from "zod";

export const startProductionSchema = z.object({
  name: z.string().min(1, "El nombre de la production es requerido."),
});

export const stopProductionSchema = z.object({});

export const createProductionSchema = z.object({
  name: z.string().min(1, "El nombre de la production es requerido."),
  description: z.string().optional().describe("Descripción opcional de la production."),
});

export const getHostsSchema = z.object({
  productionName: z.string().min(1, "El nombre de la production es requerido."),
});

export const getLogsSchema = z.object({
  maxRows: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Cantidad máxima de registros a retornar. Default: 100, máximo: 1000."),
});
