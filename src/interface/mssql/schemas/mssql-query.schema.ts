import { z } from "zod";

import { maxRowsField } from "../../shared/schemas.js";

export const mssqlInputSchema = z.object({
  query: z.string().min(1, "La consulta SQL no puede estar vacía"),
  maxRows: maxRowsField,
});
