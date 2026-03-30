import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { Closeable } from "../../server/GracefulShutdown.js";

export interface IAzureDevOpsConfig {
  readonly orgUrl: string;
  readonly pat: string;
}

export class AzureDevOpsMcpClient implements Closeable {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private discoveredTools: Tool[] = [];

  constructor(private readonly config: IAzureDevOpsConfig) {}

  private extractOrgName(orgUrl: string): string {
    const match = orgUrl.match(/dev\.azure\.com\/([^/]+)/);
    return match ? match[1] : orgUrl.replace(/\/$/, "");
  }

  async connect(): Promise<Tool[]> {
    const orgName = this.extractOrgName(this.config.orgUrl);
    console.error(`🔗 [ADO] Iniciando cliente Azure DevOps MCP para org: ${orgName}`);

    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@azure-devops/mcp", orgName, "--authentication", "envvar"],
      env: {
        ...process.env as Record<string, string>,
        AZURE_DEVOPS_ORG_URL: this.config.orgUrl,
        AZURE_DEVOPS_EXT_PAT: this.config.pat,
        ADO_MCP_AUTH_TOKEN: this.config.pat,
      },
      stderr: "inherit",
    });

    this.client = new Client(
      { name: "fc-devs-mcp-ado-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);

    const { tools } = await this.client.listTools();
    this.discoveredTools = tools;

    console.error(`✅ [ADO] Conectado. Tools disponibles: ${tools.map((t) => t.name).join(", ")}`);

    return tools;
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error("El cliente de Azure DevOps MCP no está conectado.");
    }

    const result = await this.client.callTool({ name: toolName, arguments: args });
    return result;
  }

  getDiscoveredTools(): readonly Tool[] {
    return this.discoveredTools;
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        console.error("🔗 [ADO] Cliente Azure DevOps MCP cerrado.");
      } catch (err: any) {
        console.error(`⚠️  [ADO] Error al cerrar cliente: ${err.message}`);
      } finally {
        this.client = null;
        this.transport = null;
      }
    }
  }
}
