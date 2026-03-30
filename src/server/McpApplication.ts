import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "../infrastructure/config/env.js";

import { IrisConnectionManager } from "../infrastructure/iris-intersystem/IrisConnectionManager.js";
import { IrisRepository } from "../infrastructure/iris-intersystem/IrisRepository.js";
import { IrisProductionRepository } from "../infrastructure/iris-intersystem/IrisProductionRepository.js";
import { IrisGlobalsRepository } from "../infrastructure/iris-intersystem/IrisGlobalsRepository.js";
import { AzureDevOpsMcpClient } from "../infrastructure/azure-devops/AzureDevOpsMcpClient.js";

import { ExecSQLUseCase } from "../core/use-cases/iris-intersystem/sql/ExecSQLUseCase.js";
import { ProductionUseCase } from "../core/use-cases/iris-intersystem/productions/ProductionUseCase.js";
import { GlobalsUseCase } from "../core/use-cases/iris-intersystem/globals/GlobalsUseCase.js";

import { registerIrisSQLTools } from "../interface/iris-intersystem/handlers/iris-sql.handlers.js";
import { registerIrisProductionTools } from "../interface/iris-intersystem/handlers/iris-production.handlers.js";
import { registerIrisGlobalsTools } from "../interface/iris-intersystem/handlers/iris-globals.handlers.js";
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

    const irisRepo = new IrisRepository(irisConn);
    const irisProductionRepo = new IrisProductionRepository(irisConn);
    const irisGlobalsRepo = new IrisGlobalsRepository(irisConn);

    const execSqlUseCase = new ExecSQLUseCase(irisRepo);
    const productionUseCase = new ProductionUseCase(irisProductionRepo);
    const globalsUseCase = new GlobalsUseCase(irisGlobalsRepo);

    registerIrisSQLTools(server, execSqlUseCase);
    registerIrisProductionTools(server, productionUseCase);
    registerIrisGlobalsTools(server, globalsUseCase);

    if (config.ado.enabled) {
      const adoClient = new AzureDevOpsMcpClient(config.ado);
      this.shutdown.register(adoClient);

      try {
        const adoTools = await adoClient.connect();
        registerAzureDevOpsTools(server, adoClient, adoTools);
      } catch (err: any) {
        console.error(`💥 [ADO] No se pudo conectar a Azure DevOps MCP.`);
        console.error(`   Org: ${config.ado.orgUrl}`);
        console.error(`   Error: ${err.message}`);
        console.error(`   Verifica AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PAT y que npx esté disponible.`);
        process.exit(1);
      }
    }

    this.shutdown.install((handler) => {
      transport.onclose = handler;
    });

    await server.connect(transport);

    console.error(`🚀 [MCP] Servidor "${config.server.name}" v${config.server.version} iniciado.`);
    if (config.ado.enabled) {
      console.error(`🔗 [ADO] Integración Azure DevOps activa.`);
    }
  }
}
