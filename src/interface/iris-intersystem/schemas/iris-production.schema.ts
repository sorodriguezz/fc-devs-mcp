import { z } from "zod";

export const startProductionSchema = z.object({
  name: z.string().min(1, "El nombre de la production es requerido."),
});

export const stopProductionSchema = z.object({
  timeoutSeconds: z
    .number()
    .int()
    .min(1)
    .max(300)
    .optional()
    .describe("Segundos de espera antes de forzar el stop. Default: 10."),
});

export const createProductionSchema = z.object({
  name: z.string().min(1, "El nombre de la production es requerido."),
  description: z.string().optional().describe("Descripción opcional de la production."),
});

export const getHostsSchema = z.object({
  productionName: z.string().min(1, "El nombre de la production es requerido."),
});
