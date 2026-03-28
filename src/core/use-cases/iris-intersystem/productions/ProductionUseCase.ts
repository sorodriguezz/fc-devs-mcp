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

  async stopProduction(timeoutSeconds?: number) {
    return this.productionRepo.stopProduction(timeoutSeconds);
  }

  async restartProduction() {
    return this.productionRepo.restartProduction();
  }

  async getHosts(productionName: string) {
    return this.productionRepo.getHosts(productionName);
  }
}
