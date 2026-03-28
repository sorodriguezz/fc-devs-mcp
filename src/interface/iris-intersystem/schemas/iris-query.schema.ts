import { z } from "zod";

export const inputSchema = z.object({
  query: z.string().min(1, "La consulta SQL no puede estar vacía"),
});
