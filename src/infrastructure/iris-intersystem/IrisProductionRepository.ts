import * as iris from "@intersystems/intersystems-iris-native";

import type { IrisConnectionManager } from "./IrisConnectionManager.js";
import type {
  IIrisProductionRepository,
  LogQuery,
  ProductionHost,
  ProductionInfo,
  ProductionOperationResult,
  ProductionStatus,
  QueueInfo,
} from "../../core/interfaces/IIrisProductionRepository.js";
import { LOG_TYPES, PRODUCTION_STATUS_MAP } from "../../core/interfaces/IIrisProductionRepository.js";
import type { OutputLimits, SqlTable } from "../../core/sql/SqlResult.js";
import { resolveRowLimit } from "../../core/sql/sqlUtils.js";
import { executeStatement, readColumns, readRows } from "./irisSql.js";

const LOGS_HARD_LIMIT = 1000;

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export class IrisProductionRepository implements IIrisProductionRepository {
  constructor(
    private readonly conn: IrisConnectionManager,
    private readonly limits: OutputLimits,
  ) {}

  async getStatus(): Promise<ProductionStatus> {
    const instance = this.conn.getActiveInstance();

    try {
      const { name: productionName, statusCode } = this.readProductionStatus(instance);
      const status = PRODUCTION_STATUS_MAP[statusCode] ?? "Unknown";

      console.error(`[IRIS:Production] Status: ${productionName || "(ninguna)"} → ${status}`);

      return { name: productionName, status, statusCode };
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al obtener estado de la production: ${err.message}`);
    }
  }

  async listProductions(): Promise<ProductionInfo[]> {
    try {
      const rows = this.select("SELECT Name, Description FROM Ens_Config.Production ORDER BY Name");
      return rows.map(([name, description]) => ({
        name: String(name ?? ""),
        description: String(description ?? ""),
      }));
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
      const status = instance.classMethodValue("Ens.Director", "StartProduction", name.trim());
      return this.resolveStatus(instance, status, `Production "${name}" iniciada correctamente.`);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al iniciar la production "${name}": ${err.message}`);
    }
  }

  async stopProduction(timeoutSeconds?: number, force?: boolean): Promise<ProductionOperationResult> {
    const instance = this.conn.getActiveInstance();

    try {
      // Ens.Director.StopProduction(pTimeout = 10, pForce = 0)
      const args = timeoutSeconds !== undefined || force !== undefined ? [timeoutSeconds ?? 10, force ? 1 : 0] : [];
      const status = instance.classMethodValue("Ens.Director", "StopProduction", ...args);
      return this.resolveStatus(instance, status, "Production detenida correctamente.");
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al detener la production: ${err.message}`);
    }
  }

  async restartProduction(): Promise<ProductionOperationResult> {
    const instance = this.conn.getActiveInstance();

    try {
      const { name: productionName } = this.readProductionStatus(instance);

      if (!productionName) {
        return { success: false, message: "No hay ninguna production activa para reiniciar." };
      }

      const stopStatus = instance.classMethodValue("Ens.Director", "StopProduction");
      const stopResult = this.resolveStatus(instance, stopStatus, "");
      if (!stopResult.success) return { success: false, message: `Error al detener antes del reinicio: ${stopResult.message}` };

      const startStatus = instance.classMethodValue("Ens.Director", "StartProduction", productionName);
      return this.resolveStatus(instance, startStatus, `Production "${productionName}" reiniciada correctamente.`);
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al reiniciar la production: ${err.message}`);
    }
  }

  async getHosts(productionName: string): Promise<ProductionHost[]> {
    if (!productionName?.trim()) throw new Error("El nombre de la production es requerido.");

    try {
      const rows = this.select(
        `SELECT Name, ClassName, PoolSize, Enabled FROM Ens_Config.Item
         WHERE Production = ${sqlLiteral(productionName.trim())}
         ORDER BY ClassName, Name`,
      );
      return rows.map(([name, className, poolSize, enabled]) => ({
        name: String(name ?? ""),
        className: String(className ?? ""),
        poolSize: Number(poolSize ?? 0),
        enabled: String(enabled) === "1" || enabled === true,
      }));
    } catch (err: any) {
      throw new Error(`Error al obtener hosts de la production: ${err.message}`);
    }
  }

  async getQueues(): Promise<QueueInfo[]> {
    try {
      const rows = this.select("SELECT Name, Count FROM Ens_Queue.Contents ORDER BY Name");
      return rows.map(([name, count]) => ({ name: String(name ?? ""), count: Number(count ?? 0) }));
    } catch (err: any) {
      throw new Error(`Error al obtener colas de la production: ${err.message}`);
    }
  }

  async getLogs(query: LogQuery = {}): Promise<SqlTable> {
    const limit = Math.min(resolveRowLimit(query.maxRows, this.limits.defaultMaxRows), LOGS_HARD_LIMIT);

    const filters: string[] = [];
    if (query.type) filters.push(`Type = ${LOG_TYPES.indexOf(query.type) + 1}`);
    if (query.configName?.trim()) filters.push(`ConfigName = ${sqlLiteral(query.configName.trim())}`);

    try {
      const table = this.selectTable(
        `SELECT TOP ${limit} ID, TimeLogged, Type, ConfigName, SessionId, Job, Text
         FROM Ens_Util.Log
         ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
         ORDER BY ID DESC`,
        limit,
      );
      // Type se guarda como entero (1..6); la etiqueta es más legible y cuesta lo mismo.
      const typeIdx = table.columns.indexOf("Type");
      const rows = table.rows.map((row) =>
        row.map((value, i) => (i === typeIdx ? (LOG_TYPES[Number(value) - 1] ?? value) : value)),
      );
      return { ...table, rows };
    } catch (err: any) {
      throw new Error(`Error al obtener logs de la production: ${err.message}`);
    }
  }

  async updateProduction(): Promise<ProductionOperationResult> {
    const instance = this.conn.getActiveInstance();

    try {
      const status = instance.classMethodValue("Ens.Director", "UpdateProduction");
      return this.resolveStatus(instance, status, "Production actualizada correctamente (configuración recargada).");
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al actualizar la production: ${err.message}`);
    }
  }

  async productionNeedsUpdate(): Promise<boolean> {
    const instance = this.conn.getActiveInstance();

    try {
      const result = instance.classMethodValue("Ens.Director", "ProductionNeedsUpdate");
      return Boolean(result);
    } catch (err: any) {
      throw new Error(`Error al verificar si la production necesita actualización: ${err.message}`);
    }
  }

  async recoverProduction(): Promise<ProductionOperationResult> {
    const instance = this.conn.getActiveInstance();

    try {
      const status = instance.classMethodValue("Ens.Director", "RecoverProduction");
      return this.resolveStatus(instance, status, "Production recuperada correctamente.");
    } catch (err: any) {
      this.conn.invalidate();
      throw new Error(`Error al recuperar la production: ${err.message}`);
    }
  }

  private selectTable(query: string, limit: number): SqlTable {
    const result = executeStatement(this.conn.getActiveInstance(), query);
    const columns = readColumns(result);
    const { rows, truncated } = readRows(result, columns, limit, this.limits.maxCellChars);
    return { columns, rows, rowCount: rows.length, ...(truncated ? { truncated: true as const } : {}) };
  }

  private select(query: string): ReadonlyArray<readonly unknown[]> {
    return this.selectTable(query, Number.MAX_SAFE_INTEGER).rows;
  }

  /**
   * GetProductionStatus devuelve nombre y estado por referencia (ByRef), por
   * lo que hacen falta IRISReference reales del driver.
   */
  private readProductionStatus(instance: any): { name: string; statusCode: number } {
    const nameRef = new iris.IRISReference("");
    const stateRef = new iris.IRISReference(0);
    instance.classMethodValue("Ens.Director", "GetProductionStatus", nameRef, stateRef);

    const name = nameRef.getValue();
    return {
      name: name != null ? String(name) : "",
      statusCode: Number(stateRef.getValue() ?? 0),
    };
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
}
