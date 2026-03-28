import type { IIrisGlobalsRepository } from "../../../interfaces/IIrisGlobalsRepository.js";

export class GlobalsUseCase {
  constructor(private readonly globalsRepo: IIrisGlobalsRepository) {}

  async get(globalName: string, subscripts?: string[]) {
    return this.globalsRepo.get(globalName, subscripts);
  }

  async set(globalName: string, value: string | number, subscripts?: string[]) {
    return this.globalsRepo.set(globalName, value, subscripts);
  }

  async kill(globalName: string, subscripts?: string[]) {
    return this.globalsRepo.kill(globalName, subscripts);
  }

  async exists(globalName: string, subscripts?: string[]) {
    return this.globalsRepo.exists(globalName, subscripts);
  }

  async list(
    globalName: string,
    subscripts?: string[],
    options?: { reversed?: boolean; startFrom?: string; maxItems?: number },
  ) {
    return this.globalsRepo.list(globalName, subscripts, options);
  }

  async increment(globalName: string, subscripts?: string[], delta?: number) {
    return this.globalsRepo.increment(globalName, subscripts, delta);
  }
}
