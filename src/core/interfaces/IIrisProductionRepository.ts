import type { SqlTable } from "../sql/SqlResult.js";

export type ProductionStatusCode = 1 | 2 | 3 | 4;

export type ProductionStatusLabel = "Running" | "Stopped" | "Suspended" | "Troubled" | "Unknown";

export const PRODUCTION_STATUS_MAP: Record<number, ProductionStatusLabel> = {
  1: "Running",
  2: "Stopped",
  3: "Suspended",
  4: "Troubled",
};

/** Valores de Ens_Util.Log.Type. */
export const LOG_TYPES = ["Assert", "Error", "Warning", "Info", "Trace", "Alert"] as const;
export type LogType = (typeof LOG_TYPES)[number];

export interface ProductionStatus {
  readonly name: string;
  readonly status: ProductionStatusLabel;
  readonly statusCode: number;
}

export interface ProductionInfo {
  readonly name: string;
  readonly description: string;
}

export interface ProductionHost {
  readonly name: string;
  readonly className: string;
  readonly poolSize: number;
  readonly enabled: boolean;
}

export interface ProductionOperationResult {
  readonly success: boolean;
  readonly message: string;
}

export interface QueueInfo {
  readonly name: string;
  readonly count: number;
}

export interface LogQuery {
  readonly maxRows?: number;
  readonly type?: LogType;
  readonly configName?: string;
}

export interface IIrisProductionRepository {
  getStatus(): Promise<ProductionStatus>;
  listProductions(): Promise<ProductionInfo[]>;
  createProduction(name: string, description?: string): Promise<ProductionOperationResult>;
  startProduction(name: string): Promise<ProductionOperationResult>;
  stopProduction(timeoutSeconds?: number, force?: boolean): Promise<ProductionOperationResult>;
  restartProduction(): Promise<ProductionOperationResult>;
  getHosts(productionName: string): Promise<ProductionHost[]>;
  getQueues(): Promise<QueueInfo[]>;
  /** Entradas del Event Log en formato columnar (ver {@link SqlTable}). */
  getLogs(query?: LogQuery): Promise<SqlTable>;
  updateProduction(): Promise<ProductionOperationResult>;
  productionNeedsUpdate(): Promise<boolean>;
  recoverProduction(): Promise<ProductionOperationResult>;
}
