import * as iris from "@intersystems/intersystems-iris-native";

import type { IIrisConfig } from "./IrisRepository.js";
import type { Closeable } from "../../server/GracefulShutdown.js";

export class IrisConnectionManager implements Closeable {
  private connection: any | null = null;
  private irisNative: any | null = null;

  constructor(private readonly config: IIrisConfig) {}

  getActiveInstance(): any {
    // Si el driver ya sabe que el socket se cerró (reinicio de IRIS, timeout),
    // reconectar ahora evita que la próxima tool falle de forma garantizada.
    if (!this.irisNative || !this.connection || this.isClosed()) {
      this.connect();
    }
    return this.irisNative;
  }

  invalidate(): void {
    this.release();
    console.error("⚠️  [IRIS] Conexión invalidada. Se reconectará en el próximo intento.");
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.release();
      console.error("🔌 [IRIS] Conexión cerrada correctamente.");
    }
  }

  /** Cierra el socket actual (si lo hay) para no dejarlo colgado al reconectar. */
  private release(): void {
    const previous = this.connection;
    this.irisNative = null;
    this.connection = null;
    try {
      if (previous && !previous.isClosed?.()) previous.close();
    } catch {
      /* ya estaba cerrada o rota */
    }
  }

  private isClosed(): boolean {
    try {
      return this.connection?.isClosed?.() === true;
    } catch {
      return true;
    }
  }

  private connect(): void {
    this.release();
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
