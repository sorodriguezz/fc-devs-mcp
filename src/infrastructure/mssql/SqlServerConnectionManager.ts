import sql from "mssql";

import type { Closeable } from "../../server/GracefulShutdown.js";

/**
 * Modo de autenticación contra SQL Server.
 * - "sql": autenticación clásica usuario/contraseña de SQL Server.
 * - "azure-ad-password": Microsoft Entra ID (Azure AD) con usuario/contraseña,
 *   equivalente al "Active Directory - Password" de DBeaver. Usa MSAL por debajo
 *   (incluido en tedious vía @azure/msal-node), por lo que NO requiere msal4j.
 */
export type MssqlAuthType = "sql" | "azure-ad-password";

export interface ISqlServerConfig {
  readonly hostname: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly encrypt: boolean;
  readonly trustServerCertificate: boolean;
  /** Modo de autenticación. Por defecto "sql". */
  readonly authType: MssqlAuthType;
  /** App (client) ID registrada en Entra ID. Requerido para "azure-ad-password". */
  readonly azureClientId?: string;
  /** Tenant ID de Entra ID. Requerido para "azure-ad-password". */
  readonly azureTenantId?: string;
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
    console.error(
      `🔌 [MSSQL] Iniciando conexión... (auth=${this.config.authType})`,
    );
    this.pool = await new sql.ConnectionPool(this.buildConfig()).connect();
    console.error(
      `✅ [MSSQL] Conectado → ${this.config.hostname}:${this.config.port} / ${this.config.database}`,
    );
  }

  /**
   * Construye la configuración de conexión de `mssql` según el modo de
   * autenticación seleccionado.
   */
  private buildConfig(): sql.config {
    const base: sql.config = {
      server: this.config.hostname,
      port: this.config.port,
      database: this.config.database,
      options: {
        encrypt: this.config.encrypt,
        trustServerCertificate: this.config.trustServerCertificate,
      },
    };

    if (this.config.authType === "azure-ad-password") {
      const { azureClientId, azureTenantId, username, password } = this.config;

      if (!azureClientId || !azureTenantId) {
        throw new Error(
          "[MSSQL] La autenticación 'azure-ad-password' requiere " +
            "MSSQL_AZURE_CLIENT_ID y MSSQL_AZURE_TENANT_ID.",
        );
      }
      if (!username || !password) {
        throw new Error(
          "[MSSQL] La autenticación 'azure-ad-password' requiere " +
            "MSSQL_USERNAME (correo Entra ID) y MSSQL_PASSWORD.",
        );
      }

      return {
        ...base,
        // Azure SQL siempre exige conexión cifrada.
        options: { ...base.options, encrypt: true },
        authentication: {
          type: "azure-active-directory-password",
          options: {
            userName: username,
            password,
            clientId: azureClientId,
            tenantId: azureTenantId,
          },
        },
      };
    }

    // Autenticación SQL clásica (usuario/contraseña).
    return {
      ...base,
      user: this.config.username,
      password: this.config.password,
    };
  }
}
