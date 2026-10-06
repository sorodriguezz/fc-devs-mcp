import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { config, IRIS_TOOLSETS } from "../infrastructure/config/env.js";

// ── IRIS ─────────────────────────────────────────────────────────────────────
import { IrisConnectionManager } from "../infrastructure/iris-intersystem/IrisConnectionManager.js";
import { IrisRepository } from "../infrastructure/iris-intersystem/IrisRepository.js";
import { IrisProductionRepository } from "../infrastructure/iris-intersystem/IrisProductionRepository.js";
import { IrisGlobalsRepository } from "../infrastructure/iris-intersystem/IrisGlobalsRepository.js";
import { ExecSQLUseCase } from "../core/use-cases/iris-intersystem/sql/ExecSQLUseCase.js";
import { ProductionUseCase } from "../core/use-cases/iris-intersystem/productions/ProductionUseCase.js";
import { GlobalsUseCase } from "../core/use-cases/iris-intersystem/globals/GlobalsUseCase.js";
import { registerIrisSQLTools } from "../interface/iris-intersystem/handlers/iris-sql.handlers.js";
import { registerIrisProductionTools } from "../interface/iris-intersystem/handlers/iris-production.handlers.js";
import { registerIrisGlobalsTools } from "../interface/iris-intersystem/handlers/iris-globals.handlers.js";

// ── SQL SERVER ────────────────────────────────────────────────────────────────
import { SqlServerConnectionManager } from "../infrastructure/mssql/SqlServerConnectionManager.js";
import { SqlServerRepository } from "../infrastructure/mssql/SqlServerRepository.js";
import { ExecSqlServerUseCase } from "../core/use-cases/mssql/ExecSqlServerUseCase.js";
import { registerSqlServerTools } from "../interface/mssql/handlers/mssql-sql.handlers.js";

// ── AZURE DEVOPS ──────────────────────────────────────────────────────────────
import { AzureDevOpsMcpClient } from "../infrastructure/azure-devops/AzureDevOpsMcpClient.js";
import { registerAzureDevOpsTools } from "../interface/azure-devops/handlers/ado.handlers.js";

import { GracefulShutdown } from "./GracefulShutdown.js";

export class McpApplication {
  private readonly shutdown = new GracefulShutdown();

  async start(): Promise<void> {
    const server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });
    const transport = new StdioServerTransport();

    this.validateEnabledIntegrations();

    // Las integraciones se inicializan en paralelo: el tiempo de arranque pasa
    // a ser el de la más lenta y no la suma. Las asíncronas (proceso hijo de
    // ADO, handshake TLS/Entra ID de MSSQL) se lanzan primero para que avancen
    // mientras corre la conexión de IRIS, que es síncrona.
    const adoReady = config.ado.enabled ? this.connectAzureDevOps() : undefined;
    const mssqlReady = config.mssql.enabled ? this.connectSqlServer() : undefined;
    const irisConn = config.iris.enabled ? this.connectIris() : undefined;

    const [ado, mssqlConn] = await Promise.all([adoReady, mssqlReady]);

    // El registro se hace en orden fijo para que tools/list sea estable.
    if (irisConn) this.registerIris(server, irisConn);

    if (mssqlConn) {
      const mssqlRepo = new SqlServerRepository(mssqlConn, config.output);
      registerSqlServerTools(server, new ExecSqlServerUseCase(mssqlRepo));
      console.error(`🔗 [MSSQL] Integración SQL Server activa.`);
    }

    if (ado) {
      registerAzureDevOpsTools(server, ado.client, ado.tools, config.ado);
      console.error(`🔗 [ADO] Integración Azure DevOps activa.`);
    }

    this.shutdown.install((handler) => {
      transport.onclose = handler;
    });

    await server.connect(transport);

    console.error(`🚀 [MCP] Servidor "${config.server.name}" v${config.server.version} iniciado.`);
  }

  private connectIris(): IrisConnectionManager {
    const irisConn = new IrisConnectionManager(config.iris);
    this.shutdown.register(irisConn);

    try {
      irisConn.getActiveInstance();
    } catch (err: any) {
      console.error(`💥 [IRIS] No se pudo conectar a IRIS en arranque.`);
      console.error(`   Host: ${config.iris.hostname}:${config.iris.port} / Namespace: ${config.iris.namespace}`);
      console.error(`   Error: ${err.message}`);
      process.exit(1);
    }
    return irisConn;
  }

  private registerIris(server: McpServer, irisConn: IrisConnectionManager): void {
    const toolsets = new Set(config.iris.toolsets);

    if (toolsets.has("sql")) {
      registerIrisSQLTools(server, new ExecSQLUseCase(new IrisRepository(irisConn, config.output)));
    }
    if (toolsets.has("production")) {
      registerIrisProductionTools(
        server,
        new ProductionUseCase(new IrisProductionRepository(irisConn, config.output)),
      );
    }
    if (toolsets.has("globals")) {
      registerIrisGlobalsTools(server, new GlobalsUseCase(new IrisGlobalsRepository(irisConn, config.output)));
    }

    console.error(`🔗 [IRIS] Integración InterSystems IRIS activa (toolsets: ${[...toolsets].join(", ")}).`);
  }

  private async connectSqlServer(): Promise<SqlServerConnectionManager> {
    const mssqlConn = new SqlServerConnectionManager(config.mssql);
    this.shutdown.register(mssqlConn);

    try {
      await mssqlConn.getPool();
    } catch (err: any) {
      console.error(`💥 [MSSQL] No se pudo conectar a SQL Server en arranque.`);
      console.error(`   Host: ${config.mssql.hostname}:${config.mssql.port} / DB: ${config.mssql.database}`);
      console.error(`   Error: ${err.message}`);
      process.exit(1);
    }
    return mssqlConn;
  }

  private async connectAzureDevOps(): Promise<{ client: AzureDevOpsMcpClient; tools: Tool[] }> {
    const client = new AzureDevOpsMcpClient(config.ado);
    this.shutdown.register(client);

    try {
      return { client, tools: await client.connect() };
    } catch (err: any) {
      console.error(`💥 [ADO] No se pudo conectar a Azure DevOps MCP.`);
      console.error(`   Org: ${config.ado.orgUrl}`);
      console.error(`   Error: ${err.message}`);
      console.error(`   Verifica AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PAT, ADO_DOMAINS y que el paquete @azure-devops/mcp (o npx) esté disponible.`);
      process.exit(1);
    }
  }

  /**
   * Valida que al menos una integración esté habilitada y que las variables
   * obligatorias estén presentes para cada una que sí lo esté.
   */
  private validateEnabledIntegrations(): void {
    const anyEnabled = config.iris.enabled || config.mssql.enabled || config.ado.enabled;

    if (!anyEnabled) {
      console.error(
        "⚠️  [MCP] Ninguna integración está habilitada. " +
        "Activa al menos una con IRIS_ENABLED=true, MSSQL_ENABLED=true o ADO_ENABLED=true.",
      );
    }

    if (config.iris.enabled) {
      const missing = (["hostname", "namespace", "username", "password"] as const).filter(
        (k) => !config.iris[k],
      );
      if (missing.length) {
        console.error(`💥 [IRIS] Variables requeridas faltantes: ${missing.map((k) => `IRIS_${k.toUpperCase()}`).join(", ")}`);
        process.exit(1);
      }

      const unknown = config.iris.toolsets.filter((t) => !(IRIS_TOOLSETS as readonly string[]).includes(t));
      if (unknown.length) {
        console.error(`💥 [IRIS] IRIS_TOOLSETS inválidos: ${unknown.join(", ")}. Valores válidos: ${IRIS_TOOLSETS.join(", ")}.`);
        process.exit(1);
      }
    }

    if (config.mssql.enabled) {
      const missing = (["hostname", "database", "username", "password"] as const).filter(
        (k) => !config.mssql[k],
      );
      if (missing.length) {
        console.error(`💥 [MSSQL] Variables requeridas faltantes: ${missing.map((k) => `MSSQL_${k.toUpperCase()}`).join(", ")}`);
        process.exit(1);
      }
      // En 'azure-ad-password', MSSQL_AZURE_CLIENT_ID y MSSQL_AZURE_TENANT_ID son
      // opcionales: si se omiten se usa el client público de Azure SQL y el
      // tenant se deriva del dominio del correo (igual que DBeaver).
    }

    if (config.ado.enabled) {
      const missing = (["orgUrl", "pat"] as const).filter((k) => !config.ado[k]);
      if (missing.length) {
        const nameMap: Record<string, string> = { orgUrl: "AZURE_DEVOPS_ORG_URL", pat: "AZURE_DEVOPS_PAT" };
        console.error(`💥 [ADO] Variables requeridas faltantes: ${missing.map((k) => nameMap[k]).join(", ")}`);
        process.exit(1);
      }
    }
  }
}
