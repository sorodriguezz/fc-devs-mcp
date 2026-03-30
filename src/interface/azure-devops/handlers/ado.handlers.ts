import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { AzureDevOpsMcpClient } from "../../../infrastructure/azure-devops/AzureDevOpsMcpClient.js";

export function registerAzureDevOpsTools(
  server: McpServer,
  adoClient: AzureDevOpsMcpClient,
  tools: readonly Tool[],
): void {
  if (tools.length === 0) {
    console.error("⚠️  [ADO] No se encontraron tools en el servidor Azure DevOps MCP.");
    return;
  }

  for (const tool of tools) {
    const toolName = tool.name;
    const toolDescription = tool.description ?? `Azure DevOps: ${toolName}`;

    server.registerTool(
      toolName,
      {
        title: tool.title ?? toolName,
        description: `[Azure DevOps] ${toolDescription}`,
        inputSchema: z.record(z.string(), z.unknown()),
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await adoClient.callTool(toolName, args);
          return {
            content: [
              {
                type: "text" as const,
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `[ADO Error] ${err.message}` }],
          };
        }
      },
    );
  }

  console.error(`✅ [ADO] ${tools.length} tools registrados desde Azure DevOps MCP.`);
}
