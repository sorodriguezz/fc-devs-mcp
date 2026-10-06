import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { Closeable } from "../../server/GracefulShutdown.js";

const ADO_MCP_PACKAGE = "@azure-devops/mcp";

export interface IAzureDevOpsConfig {
  readonly orgUrl: string;
  readonly pat: string;
  /** Dominios del MCP oficial a cargar (`-d`). Vacío = todos. */
  readonly domains: readonly string[];
  /** Allowlist de tools por nombre (se aplica en el proxy). */
  readonly tools: readonly string[];
  readonly paramDescMaxChars: number;
  readonly compactResponses: boolean;
}

/**
 * Prefiere el paquete instalado localmente (optionalDependency) y lo ejecuta
 * con el mismo `node`: evita que `npx` resuelva/consulte el registry en cada
 * arranque (~2 s en caliente, >10 s la primera vez). Si no está instalado,
 * cae a `npx` como antes.
 */
function resolveLaunchCommand(): { command: string; args: string[] } {
  try {
    const require = createRequire(import.meta.url);
    const pkgJsonPath = require.resolve(`${ADO_MCP_PACKAGE}/package.json`);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { bin?: string | Record<string, string> };
    const bin = typeof pkg.bin === "string" ? pkg.bin : Object.values(pkg.bin ?? {})[0];
    if (bin) {
      return { command: process.execPath, args: [path.join(path.dirname(pkgJsonPath), bin)] };
    }
  } catch {
    /* no instalado localmente */
  }
  return { command: "npx", args: ["-y", ADO_MCP_PACKAGE] };
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
    const launch = resolveLaunchCommand();
    const domainArgs = this.config.domains.length ? ["-d", ...this.config.domains] : [];

    console.error(
      `🔗 [ADO] Iniciando cliente Azure DevOps MCP para org: ${orgName}` +
        ` (${launch.command === "npx" ? "npx" : "paquete local"}` +
        `${domainArgs.length ? `, dominios: ${this.config.domains.join(" ")}` : ""})`,
    );

    this.transport = new StdioClientTransport({
      command: launch.command,
      args: [...launch.args, orgName, "--authentication", "envvar", ...domainArgs],
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

    return this.client.callTool({ name: toolName, arguments: args });
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
