import { z } from "zod";

import { config } from "../../infrastructure/config/env.js";

export const MAX_ROWS_LIMIT = 5000;

export const maxRowsField = z
  .number()
  .int()
  .min(1)
  .max(MAX_ROWS_LIMIT)
  .optional()
  .describe(`Máx. filas a devolver (default ${config.output.defaultMaxRows}). Si hay más, la respuesta trae truncated:true.`);
