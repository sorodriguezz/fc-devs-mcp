import { z } from "zod";

const globalNameField = z.string().min(1, "El nombre del global es requerido.");

const subscriptsField = z
  .array(z.string())
  .optional()
  .describe("Lista de subscripts del nodo. Ejemplo: ['Pacientes', '123']");

export const globalGetSchema = z.object({
  globalName: globalNameField,
  subscripts: subscriptsField,
});

export const globalSetSchema = z.object({
  globalName: globalNameField,
  subscripts: subscriptsField,
  value: z
    .union([z.string(), z.number()])
    .describe("Valor a almacenar en el nodo. Puede ser string o número."),
});

export const globalKillSchema = z.object({
  globalName: globalNameField,
  subscripts: subscriptsField,
});

export const globalExistsSchema = z.object({
  globalName: globalNameField,
  subscripts: subscriptsField,
});

export const globalListSchema = z.object({
  globalName: globalNameField,
  subscripts: subscriptsField,
  reversed: z
    .boolean()
    .optional()
    .describe("Si es true, itera en orden de collation inverso. Default: false."),
  startFrom: z
    .string()
    .optional()
    .describe("Subscript inicial desde donde comenzar la iteración."),
  maxItems: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Máximo de nodos a retornar. Default: 100, máximo: 1000."),
});

export const globalIncrementSchema = z.object({
  globalName: globalNameField,
  subscripts: subscriptsField,
  delta: z
    .number()
    .optional()
    .describe("Valor a sumar al nodo. Puede ser negativo para decrementar. Default: 1."),
});
