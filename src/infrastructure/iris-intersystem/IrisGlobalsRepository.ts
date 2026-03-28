import type { IrisConnectionManager } from "./IrisConnectionManager.js";
import type {
  GlobalExistsResult,
  GlobalNode,
  GlobalNodeState,
  IIrisGlobalsRepository,
} from "../../core/interfaces/IIrisGlobalsRepository.js";

export class IrisGlobalsRepository implements IIrisGlobalsRepository {
  constructor(private readonly conn: IrisConnectionManager) {}

  async get(globalName: string, subscripts: string[] = []): Promise<string | number | null> {
    this.validateGlobalName(globalName);
    const instance = this.conn.getActiveInstance();

    try {
      const value = instance.get(globalName, ...subscripts);
      return value ?? null;
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al leer global ^${globalName}: ${err.message}`);
    }
  }

  async set(globalName: string, value: string | number, subscripts: string[] = []): Promise<void> {
    this.validateGlobalName(globalName);
    const instance = this.conn.getActiveInstance();

    try {
      instance.set(value, globalName, ...subscripts);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al escribir global ^${globalName}: ${err.message}`);
    }
  }

  async kill(globalName: string, subscripts: string[] = []): Promise<void> {
    this.validateGlobalName(globalName);
    const instance = this.conn.getActiveInstance();

    try {
      instance.kill(globalName, ...subscripts);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al eliminar global ^${globalName}: ${err.message}`);
    }
  }

  async exists(globalName: string, subscripts: string[] = []): Promise<GlobalExistsResult> {
    this.validateGlobalName(globalName);
    const instance = this.conn.getActiveInstance();

    try {
      const state = (instance.isDefined(globalName, ...subscripts) ?? 0) as GlobalNodeState;
      return {
        state,
        exists: state > 0,
        hasValue: state % 10 > 0,
        hasChildren: state > 9,
      };
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al verificar global ^${globalName}: ${err.message}`);
    }
  }

  async list(
    globalName: string,
    subscripts: string[] = [],
    options: { reversed?: boolean; startFrom?: string; maxItems?: number } = {},
  ): Promise<GlobalNode[]> {
    this.validateGlobalName(globalName);
    const instance = this.conn.getActiveInstance();
    const { reversed = false, startFrom, maxItems = 100 } = options;
    const safeMax = Math.max(1, Math.min(maxItems, 1000));

    try {
      let iter = instance.iterator(globalName, ...subscripts);

      if (reversed) iter = iter.reversed();
      if (startFrom !== undefined) iter = iter.startFrom(startFrom);

      const nodes: GlobalNode[] = [];
      for (const [key, value] of iter) {
        nodes.push({ key: String(key), value: value ?? null });
        if (nodes.length >= safeMax) break;
      }
      return nodes;
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al iterar global ^${globalName}: ${err.message}`);
    }
  }

  async increment(globalName: string, subscripts: string[] = [], delta = 1): Promise<number> {
    this.validateGlobalName(globalName);
    const instance = this.conn.getActiveInstance();

    try {
      const result = instance.increment(delta, globalName, ...subscripts);
      return Number(result);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al incrementar global ^${globalName}: ${err.message}`);
    }
  }

  private validateGlobalName(name: string): void {
    if (!name?.trim()) throw new Error("El nombre del global no puede estar vacío.");
    if (!/^[%A-Za-z][A-Za-z0-9.]*$/.test(name.trim())) {
      throw new Error(
        `Nombre de global inválido: "${name}". Solo letras, números y puntos. Debe comenzar con letra o %.`,
      );
    }
  }
}
