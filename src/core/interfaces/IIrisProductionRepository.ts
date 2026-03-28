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
  readonly autoStart: boolean;
  // Nota: Ens_Config.Production no tiene columna Enabled.
  // La production se activa/desactiva via Start/StopProduction.
}

export interface ProductionHost {
  readonly name: string;
  /** Nombre completo de la clase ObjectScript del host (ej: EnsLib.HL7.Service.TCPService) */
  readonly className: string;
  readonly poolSize: number;
  readonly enabled: boolean;
}

export interface ProductionOperationResult {
  readonly success: boolean;
  readonly message: string;
}

export interface IIrisProductionRepository {
  getStatus(): Promise<ProductionStatus>;
  listProductions(): Promise<ProductionInfo[]>;
  startProduction(name: string): Promise<ProductionOperationResult>;
  stopProduction(timeoutSeconds?: number): Promise<ProductionOperationResult>;
  restartProduction(): Promise<ProductionOperationResult>;
  getHosts(productionName: string): Promise<ProductionHost[]>;
}
