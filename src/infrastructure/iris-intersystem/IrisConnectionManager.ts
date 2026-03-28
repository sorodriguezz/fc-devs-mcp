import * as iris from "@intersystems/intersystems-iris-native";

import type { IIrisConfig } from "./IrisRepository.js";
import type { Closeable } from "../../server/GracefulShutdown.js";

export class IrisConnectionManager implements Closeable {
  private connection: any | null = null;
  private irisNative: any | null = null;

  constructor(private readonly config: IIrisConfig) {}

  getActiveInstance(): any {
    if (!this.irisNative || !this.connection) {
      this.connect();
    }
    return this.irisNative;
  }

  invalidate(): void {
    this.irisNative = null;
    this.connection = null;
    console.error("⚠️  [IRIS] Conexión invalidada. Se reconectará en el próximo intento.");
  }

  async close(): Promise<void> {
    if (this.connection) {
      try {
        this.connection.close();
        console.error("🔌 [IRIS] Conexión cerrada correctamente.");
      } finally {
        this.invalidate();
      }
    }
  }

  private connect(): void {
    console.error("🔌 [IRIS] Iniciando conexión...");
    this.connection = iris.createConnection({
      host: this.config.hostname,
      port: this.config.port,
      ns: this.config.namespace,
      user: this.config.username,
      pwd: this.config.password,
      sharedmemory: false,
      sslconfig: false,
    });
    this.irisNative = this.connection.createIris();
    console.error(
      `✅ [IRIS] Conectado → ${this.config.hostname}:${this.config.port} / ${this.config.namespace}`,
    );
  }
}
