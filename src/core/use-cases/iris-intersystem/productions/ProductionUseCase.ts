import type {
  IIrisProductionRepository,
  LogQuery,
} from "../../../interfaces/IIrisProductionRepository.js";

export class ProductionUseCase {
  constructor(private readonly productionRepo: IIrisProductionRepository) {}

  async getStatus() {
    return this.productionRepo.getStatus();
  }

  async listProductions() {
    return this.productionRepo.listProductions();
  }

  async createProduction(name: string, description?: string) {
    return this.productionRepo.createProduction(name, description);
  }

  async startProduction(name: string) {
    return this.productionRepo.startProduction(name);
  }

  async stopProduction(timeoutSeconds?: number, force?: boolean) {
    return this.productionRepo.stopProduction(timeoutSeconds, force);
  }

  async restartProduction() {
    return this.productionRepo.restartProduction();
  }

  async getHosts(productionName: string) {
    return this.productionRepo.getHosts(productionName);
  }

  async getQueues() {
    return this.productionRepo.getQueues();
  }

  async getLogs(query?: LogQuery) {
    return this.productionRepo.getLogs(query);
  }

  async updateProduction() {
    return this.productionRepo.updateProduction();
  }

  async productionNeedsUpdate() {
    return this.productionRepo.productionNeedsUpdate();
  }

  async recoverProduction() {
    return this.productionRepo.recoverProduction();
  }
}
