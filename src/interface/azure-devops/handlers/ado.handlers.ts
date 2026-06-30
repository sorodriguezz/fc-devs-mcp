import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { AzureDevOpsMcpClient } from "../../../infrastructure/azure-devops/AzureDevOpsMcpClient.js";
import { buildInputShape, normalizeArgs } from "../jsonSchemaToZod.js";

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

    // Reconstruimos el schema real de la tool upstream (en vez de un record
    // genérico) para que el cliente reciba los tipos correctos y, sobre todo,
    // para coercionar los parámetros tipo `array`/`object` que llegan
    // serializados como string JSON. Sin esto, el MCP oficial rechaza la
    // llamada con `expected array, received string`.
    const inputShape = buildInputShape(tool.inputSchema);

    server.registerTool(
      toolName,
      {
        title: tool.title ?? toolName,
        description: `[Azure DevOps] ${toolDescription}`,
        inputSchema: inputShape,
      },
      async (args: Record<string, unknown>) => {
        try {
          // Red de seguridad: aunque el schema ya coerciona, normalizamos de
          // nuevo por si algún argumento array/object llegara aún como string.
          const normalized = normalizeArgs(args ?? {}, tool.inputSchema);
          const result = await adoClient.callTool(toolName, normalized);
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
