import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "../infrastructure/config/env.js";

// Infrastructure
import { IrisConnectionManager } from "../infrastructure/iris-intersystem/IrisConnectionManager.js";
import { IrisRepository } from "../infrastructure/iris-intersystem/IrisRepository.js";
import { IrisProductionRepository } from "../infrastructure/iris-intersystem/IrisProductionRepository.js";
import { AzureDevOpsMcpClient } from "../infrastructure/azure-devops/AzureDevOpsMcpClient.js";

// Use Cases
import { ExecSQLUseCase } from "../core/use-cases/iris-intersystem/ExecSQL.js";
import { ProductionUseCase } from "../core/use-cases/iris-intersystem/productions/ProductionUseCase.js";

// Tool Handlers
import { registerIrisSQLTools } from "../interface/iris-intersystem/handlers/iris-sql.handlers.js";
import { registerIrisProductionTools } from "../interface/iris-intersystem/handlers/iris-production.handlers.js";
import { registerAzureDevOpsTools } from "../interface/azure-devops/handlers/ado.handlers.js";

// Lifecycle
import { GracefulShutdown } from "./GracefulShutdown.js";

export class McpApplication {
  private readonly shutdown = new GracefulShutdown();

  async start(): Promise<void> {
    const server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });
    const transport = new StdioServerTransport();

    // ── Infrastructure ──────────────────────────────────────────
    // Una sola conexión IRIS compartida entre todos los repositorios IRIS
    const irisConn = new IrisConnectionManager(config.iris);
    this.shutdown.register(irisConn);

    const irisRepo = new IrisRepository(irisConn);
    const irisProductionRepo = new IrisProductionRepository(irisConn);

    // Azure DevOps MCP (opcional — solo si ADO_ENABLED=true)
    let adoClient: AzureDevOpsMcpClient | null = null;
    if (config.ado.enabled) {
      adoClient = new AzureDevOpsMcpClient(config.ado);
      this.shutdown.register(adoClient);
    }

    // ── Use Cases ───────────────────────────────────────────────
    const execSqlUseCase = new ExecSQLUseCase(irisRepo);
    const productionUseCase = new ProductionUseCase(irisProductionRepo);

    // ── Tools ────────────────────────────────────────────────────
    registerIrisSQLTools(server, execSqlUseCase);
    registerIrisProductionTools(server, productionUseCase);

    if (adoClient) {
      try {
        const adoTools = await adoClient.connect();
        registerAzureDevOpsTools(server, adoClient, adoTools);
      } catch (err: any) {
        // El servidor arranca igual si ADO falla — IRIS sigue operativo
        console.error(`⚠️  [ADO] No se pudo conectar al servidor Azure DevOps MCP: ${err.message}`);
        console.error("     Verifica AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PAT y que npx esté disponible.");
      }
    }

    // ── Lifecycle ───────────────────────────────────────────────
    this.shutdown.install((handler) => {
      transport.onclose = handler;
    });

    await server.connect(transport);

    console.error(
      `🚀 [MCP] Servidor "${config.server.name}" v${config.server.version} iniciado.`,
    );
    if (config.ado.enabled) {
      console.error(`🔗 [ADO] Integración Azure DevOps ${adoClient ? "activa" : "falló al iniciar"}.`);
    }
  }
}
