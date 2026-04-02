import { z } from "zod";

export const mssqlInputSchema = z.object({
  query: z.string().min(1, "La consulta SQL no puede estar vacía"),
  maxRows: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Número máximo de filas a retornar (solo aplica para SELECT)"),
});
