export type ProductionStatusCode = 1 | 2 | 3 | 4;

export type ProductionStatusLabel = "Running" | "Stopped" | "Suspended" | "Troubled" | "Unknown";

export const PRODUCTION_STATUS_MAP: Record<number, ProductionStatusLabel> = {
  1: "Running",
  2: "Stopped",
  3: "Suspended",
  4: "Troubled",
};

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

export interface LogEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly job: string;
  readonly type: string;
  readonly configName: string;
  readonly text: string;
  readonly timeLogged: string;
}

export interface IIrisProductionRepository {
  getStatus(): Promise<ProductionStatus>;
  listProductions(): Promise<ProductionInfo[]>;
  createProduction(name: string, description?: string): Promise<ProductionOperationResult>;
  startProduction(name: string): Promise<ProductionOperationResult>;
  stopProduction(): Promise<ProductionOperationResult>;
  restartProduction(): Promise<ProductionOperationResult>;
  getHosts(productionName: string): Promise<ProductionHost[]>;
  getQueues(): Promise<QueueInfo[]>;
  getLogs(maxRows?: number): Promise<LogEntry[]>;
  updateProduction(): Promise<ProductionOperationResult>;
  productionNeedsUpdate(): Promise<boolean>;
  recoverProduction(): Promise<ProductionOperationResult>;
}
