import sql from "mssql";

import type { Closeable } from "../../server/GracefulShutdown.js";

export interface ISqlServerConfig {
  readonly hostname: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly encrypt: boolean;
  readonly trustServerCertificate: boolean;
}

export class SqlServerConnectionManager implements Closeable {
  private pool: sql.ConnectionPool | null = null;

  constructor(private readonly config: ISqlServerConfig) {}

  async getPool(): Promise<sql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      await this.connect();
    }
    return this.pool!;
  }

  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
        console.error("🔌 [MSSQL] Pool cerrado correctamente.");
      } catch (err: any) {
        console.error(`⚠️  [MSSQL] Error al cerrar pool: ${err.message}`);
      } finally {
        this.pool = null;
      }
    }
  }

  private async connect(): Promise<void> {
    console.error("🔌 [MSSQL] Iniciando conexión...");
    this.pool = await new sql.ConnectionPool({
      server: this.config.hostname,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      options: {
        encrypt: this.config.encrypt,
        trustServerCertificate: this.config.trustServerCertificate,
      },
    }).connect();
    console.error(
      `✅ [MSSQL] Conectado → ${this.config.hostname}:${this.config.port} / ${this.config.database}`,
    );
  }
}
