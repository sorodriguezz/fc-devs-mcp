import type { IIrisProductionRepository } from "../../../interfaces/IIrisProductionRepository.js";

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

  async stopProduction() {
    return this.productionRepo.stopProduction();
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

  async getLogs(maxRows?: number) {
    return this.productionRepo.getLogs(maxRows);
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
