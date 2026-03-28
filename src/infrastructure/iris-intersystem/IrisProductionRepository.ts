import type { IrisConnectionManager } from "./IrisConnectionManager.js";
import type {
  IIrisProductionRepository,
  ProductionHost,
  ProductionInfo,
  ProductionOperationResult,
  ProductionStatus,
} from "../../core/interfaces/IIrisProductionRepository.js";
import { PRODUCTION_STATUS_MAP } from "../../core/interfaces/IIrisProductionRepository.js";

export class IrisProductionRepository implements IIrisProductionRepository {
  constructor(private readonly conn: IrisConnectionManager) {}

  async getStatus(): Promise<ProductionStatus> {
    const instance = this.conn.getActiveInstance();

    try {
      const nameRef = new (instance.constructor?.IRISReference
        ? instance.constructor.IRISReference
        : this.getIrisReference(instance))("");

      const statusCode = Number(
        instance.classMethodValue("Ens.Director", "GetProductionStatus", nameRef) ?? 0,
      );

      const productionName = this.resolveReference(nameRef);
      const status = PRODUCTION_STATUS_MAP[statusCode] ?? "Unknown";

      console.error(`[IRIS:Production] Status: ${productionName || "(ninguna)"} → ${status}`);

      return {
        name: productionName || "",
        status,
        statusCode,
      };
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al obtener estado de la production: ${err.message}`);
    }
  }

  async listProductions(): Promise<ProductionInfo[]> {
    const instance = this.conn.getActiveInstance();

    const query = "SELECT Name, Description FROM Ens_Config.Production ORDER BY Name";

    try {
      const result = instance.classMethodObject("%SYSTEM.SQL", "Execute", query);
      if (!result) return [];

      const sqlCode = Number(result.get("%SQLCODE") ?? 0);
      if (sqlCode < 0) {
        const msg = String(result.get("%Message") ?? "");
        throw new Error(`SQL Error [${sqlCode}]: ${msg}`);
      }

      const productions: ProductionInfo[] = [];
      while (result.invokeBoolean("%Next")) {
        productions.push({
          name: result.invokeString("%Get", "Name") ?? "",
          description: result.invokeString("%Get", "Description") ?? "",
        });
      }
      return productions;
    } catch (err: any) {
      throw new Error(`Error al listar productions: ${err.message}`);
    }
  }

  async createProduction(name: string, description = ""): Promise<ProductionOperationResult> {
    if (!name?.trim()) throw new Error("El nombre de la production no puede estar vacío.");

    const instance = this.conn.getActiveInstance();

    try {
      const existing = instance.classMethodValue("Ens.Config.Production", "%ExistsId", name.trim());
      if (existing) {
        return { success: false, message: `La production "${name}" ya existe.` };
      }

      const prod = instance.classMethodObject("Ens.Config.Production", "%New");
      prod.set("Name", name.trim());
      prod.set("Description", description.trim());

      const status = prod.invoke("%Save");
      return this.resolveStatus(instance, status, `Production "${name}" creada correctamente.`);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al crear la production "${name}": ${err.message}`);
    }
  }

  async startProduction(name: string): Promise<ProductionOperationResult> {
    if (!name?.trim()) throw new Error("El nombre de la production no puede estar vacío.");

    const instance = this.conn.getActiveInstance();

    try {
      const status = instance.classMethodValue("Ens.Director", "StartProduction", name.trim(), 10);
      return this.resolveStatus(instance, status, `Production "${name}" iniciada correctamente.`);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al iniciar la production "${name}": ${err.message}`);
    }
  }

  async stopProduction(timeoutSeconds = 10): Promise<ProductionOperationResult> {
    const instance = this.conn.getActiveInstance();

    try {
      const status = instance.classMethodValue(
        "Ens.Director",
        "StopProduction",
        timeoutSeconds,
        0,
      );
      return this.resolveStatus(instance, status, "Production detenida correctamente.");
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al detener la production: ${err.message}`);
    }
  }

  async restartProduction(): Promise<ProductionOperationResult> {
    const instance = this.conn.getActiveInstance();

    try {
      const status = instance.classMethodValue("Ens.Director", "UpdateProduction", 10);
      return this.resolveStatus(instance, status, "Production reiniciada correctamente.");
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al reiniciar la production: ${err.message}`);
    }
  }

  async getHosts(productionName: string): Promise<ProductionHost[]> {
    if (!productionName?.trim()) throw new Error("El nombre de la production es requerido.");

    const instance = this.conn.getActiveInstance();
    const safeName = productionName.trim().replace(/'/g, "''");
    const query = `
      SELECT Name, ClassName, PoolSize, Enabled
      FROM Ens_Config.Item
      WHERE Production = '${safeName}'
      ORDER BY ClassName, Name
    `;

    try {
      const result = instance.classMethodObject("%SYSTEM.SQL", "Execute", query);
      if (!result) return [];

      const sqlCode = Number(result.get("%SQLCODE") ?? 0);
      if (sqlCode < 0) {
        const msg = String(result.get("%Message") ?? "");
        throw new Error(`SQL Error [${sqlCode}]: ${msg}`);
      }

      const hosts: ProductionHost[] = [];
      while (result.invokeBoolean("%Next")) {
        hosts.push({
          name: result.invokeString("%Get", "Name") ?? "",
          className: result.invokeString("%Get", "ClassName") ?? "",
          poolSize: Number(result.invokeString("%Get", "PoolSize") ?? 0),
          enabled: result.invokeString("%Get", "Enabled") === "1",
        });
      }
      return hosts;
    } catch (err: any) {
      throw new Error(`Error al obtener hosts de la production: ${err.message}`);
    }
  }

  private resolveStatus(
    instance: any,
    status: unknown,
    successMessage: string,
  ): ProductionOperationResult {
    try {
      const isOk = instance.classMethodValue("%SYSTEM.Status", "IsOK", status);
      if (isOk) {
        return { success: true, message: successMessage };
      }

      const errorText = instance.classMethodString(
        "%SYSTEM.Status",
        "GetErrorText",
        status,
      ) ?? "Error desconocido en IRIS.";

      return { success: false, message: errorText };
    } catch {
      return { success: true, message: successMessage };
    }
  }

  private getIrisReference(instance: any): new (v: unknown) => { getValue(): unknown } {
    try {
      const irisModule = require("@intersystems/intersystems-iris-native");
      if (irisModule?.IRISReference) return irisModule.IRISReference;
    } catch {}

    return class {
      private _val: unknown;
      constructor(v: unknown) { this._val = v; }
      getValue(): unknown { return this._val; }
    };
  }

  private resolveReference(ref: { getValue(): unknown }): string {
    try {
      const val = ref.getValue();
      return val != null ? String(val) : "";
    } catch {
      return "";
    }
  }
}
