import * as iris from "@intersystems/intersystems-iris-native";

import type { IIrisRepository } from "../../core/interfaces/IIrisRepository.js";

export interface IIrisConfig {
  hostname: string;
  port: number;
  namespace: string;
  username: string;
  password: string;
}

export class IrisRepository implements IIrisRepository {
  private db: any;
  private irisInstance: any;

  constructor(private readonly config: IIrisConfig) {}

  private async ensureConnection() {
    if (!this.db) {
      console.error("🔌 Conectando a InterSystems IRIS por primera vez...");
      this.db = iris.createConnection({
        host: this.config.hostname,
        port: this.config.port,
        ns: this.config.namespace,
        user: this.config.username,
        pwd: this.config.password,
        sharedmemory: false,
        sslconfig: false,
      });
      this.irisInstance = this.db.createIris();
    }
    return this.irisInstance;
  }
  async executeSql(query: string): Promise<any> {
    const irisNative = await this.ensureConnection();

    console.error(`[DEBUG] Ejecutando SQL: ${query}`);

    const result = irisNative.classMethodObject(
      "%SYSTEM.SQL",
      "Execute",
      query,
    );
    if (!result)
      throw new Error(
        "Fallo crítico: IRIS no devolvió un objeto de resultado.",
      );

    let sqlCode = 0;
    let sqlMessage = "";

    try {
      sqlCode = result.invokeInteger("%SQLCODEGet");
      sqlMessage = result.invokeString("%MessageGet");
    } catch (e1) {
      try {
        sqlCode = result.invokeInteger("SQLCODEGet");
        sqlMessage = result.invokeString("MessageGet");
      } catch (e2: any) {
        console.error(
          `[WARN] No se pudo leer la propiedad SQLCODE del objeto devuelto. Error: ${e2.message}`,
        );
      }
    }

    if (sqlCode < 0) {
      throw new Error(
        `IRIS DB Error (${sqlCode}): ${sqlMessage || "Instrucción inválida o tabla no encontrada."}`,
      );
    }

    const columns = this.getSqlColumns(result);

    if (columns.length === 0) {
      let rowCount = 0;
      try {
        rowCount = result.invokeInteger("%ROWCOUNTGet");
      } catch (e1) {
        try {
          rowCount = result.invokeInteger("ROWCOUNTGet");
        } catch (e2) {}
      }

      return {
        operation: "DML",
        success: true,
        rowsAffected: rowCount,
        message: `Operación ejecutada correctamente. Filas afectadas: ${rowCount}`,
      };
    }

    const rows = [];
    let hasRow = result.invokeBoolean("%Next");
    while (hasRow) {
      const row: any = {};
      for (const col of columns) {
        try {
          row[col] = result.invokeString("%Get", col);
        } catch (e) {
          row[col] = null;
        }
      }
      rows.push(row);
      hasRow = result.invokeBoolean("%Next");
    }

    return rows;
  }

  private getSqlColumns(result: any): string[] {
    try {
      const metadata = result.invokeObject("%GetMetadata");
      if (!metadata) return [];
      const rowType = metadata.invokeString("GenerateRowType");
      if (!rowType) return [];
      return rowType
        .replace(/^ROW\(|\)$/gi, "")
        .split(",")
        .map((chunk: string) =>
          chunk.trim().split(/\s+/)[0].replace(/^"|"$/g, ""),
        )
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  async close() {
    if (this.db) this.db.close();
  }
}
