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

/**
 * Client ID público que usa el driver oficial de Microsoft (mssql-jdbc) — y por
 * lo tanto DBeaver en su modo "Active Directory - Password" — para el flujo
 * ROPC contra Azure SQL. Al venir como default, el usuario solo necesita
 * indicar usuario + contraseña, igual que en DBeaver.
 * Fuente: mssql-jdbc ActiveDirectoryAuthentication.JDBC_FEDAUTH_CLIENT_ID.
 */
export const DEFAULT_AZURE_SQL_CLIENT_ID =
  "7f98cb04-cd1e-40df-9140-3bf7e2cea4db";

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
  /**
   * App (client) ID de Entra ID. Opcional: si se omite se usa el client público
   * de Azure SQL ({@link DEFAULT_AZURE_SQL_CLIENT_ID}), como hace DBeaver.
   */
  readonly azureClientId?: string;
  /**
   * Tenant de Entra ID. Opcional: si se omite se deriva del dominio del correo
   * en `username` (ej. `usuario@empresa.cl` → `empresa.cl`), y si no es posible
   * se usa `organizations`.
   */
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
      const { username, password } = this.config;

      // Solo usuario + contraseña son obligatorios (igual que DBeaver).
      if (!username || !password) {
        throw new Error(
          "[MSSQL] La autenticación 'azure-ad-password' requiere " +
            "MSSQL_USERNAME (correo Entra ID) y MSSQL_PASSWORD.",
        );
      }

      // Client público de Azure SQL por defecto; el tenant se deriva del correo.
      const clientId = this.config.azureClientId?.trim() || DEFAULT_AZURE_SQL_CLIENT_ID;
      const tenantId = this.resolveTenantId(username);

      return {
        ...base,
        // Azure SQL siempre exige conexión cifrada.
        options: { ...base.options, encrypt: true },
        authentication: {
          type: "azure-active-directory-password",
          options: {
            userName: username,
            password,
            clientId,
            tenantId,
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

  /**
   * Determina el tenant de Entra ID para el flujo azure-ad-password.
   * Prioridad: valor explícito → dominio del correo (`user@dominio`) →
   * `organizations`. Entra ID acepta un dominio verificado como autoridad,
   * por eso no hace falta el GUID del tenant.
   */
  private resolveTenantId(username: string): string {
    const explicit = this.config.azureTenantId?.trim();
    if (explicit) return explicit;

    const domain = username.includes("@") ? username.split("@").pop()?.trim() : "";
    return domain || "organizations";
  }
}
