import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import type { AzureDevOpsMcpClient } from "../../../infrastructure/azure-devops/AzureDevOpsMcpClient.js";
import { capText } from "../../shared/toolResponse.js";
import { compactText } from "../compactResponse.js";
import { buildInputShape, normalizeArgs } from "../jsonSchemaToZod.js";

export interface AdoProxyOptions {
  /** Allowlist de tools; admite comodín final (`wit_*`). Vacía = todas. */
  readonly tools: readonly string[];
  readonly paramDescMaxChars: number;
  readonly compactResponses: boolean;
}

function isAllowed(toolName: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((p) => (p.endsWith("*") ? toolName.startsWith(p.slice(0, -1)) : toolName === p));
}

/**
 * Reenvía el resultado upstream tal cual (content + isError) en vez de
 * serializar el objeto completo: JSON.stringify(result) metía el JSON de la
 * respuesta como string escapado dentro de otro JSON (cada `"` → `\"`, cada
 * salto de línea → `\n`) y además perdía el `isError` del MCP oficial.
 */
function toProxyResult(result: unknown, compact: boolean): CallToolResult {
  const upstream = result as Partial<CallToolResult> | undefined;
  if (!upstream || !Array.isArray(upstream.content)) {
    return { content: [{ type: "text", text: capText(JSON.stringify(result) ?? "") }] };
  }

  const content = upstream.content.map((item) =>
    item.type === "text"
      ? { ...item, text: capText(compact ? compactText(item.text) : item.text) }
      : item,
  );
  return upstream.isError ? { isError: true, content } : { content };
}

export function registerAzureDevOpsTools(
  server: McpServer,
  adoClient: AzureDevOpsMcpClient,
  tools: readonly Tool[],
  options: AdoProxyOptions,
): void {
  const selected = tools.filter((tool) => isAllowed(tool.name, options.tools));

  if (selected.length === 0) {
    console.error("⚠️  [ADO] No se encontraron tools en el servidor Azure DevOps MCP (revisa ADO_DOMAINS / ADO_TOOLS).");
    return;
  }

  for (const tool of selected) {
    const toolName = tool.name;
    const toolDescription = tool.description ?? `Azure DevOps: ${toolName}`;

    // Reconstruimos el schema real de la tool upstream (en vez de un record
    // genérico) para que el cliente reciba los tipos correctos y, sobre todo,
    // para coercionar los parámetros tipo `array`/`object` que llegan
    // serializados como string JSON. Sin esto, el MCP oficial rechaza la
    // llamada con `expected array, received string`.
    const inputShape = buildInputShape(tool.inputSchema, options);

    server.registerTool(
      toolName,
      {
        title: tool.title ?? toolName,
        description: `[Azure DevOps] ${toolDescription}`,
        inputSchema: inputShape,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (args: Record<string, unknown>) => {
        try {
          // Red de seguridad: aunque el schema ya coerciona, normalizamos de
          // nuevo por si algún argumento array/object llegara aún como string.
          const normalized = normalizeArgs(args ?? {}, tool.inputSchema);
          const result = await adoClient.callTool(toolName, normalized);
          return toProxyResult(result, options.compactResponses);
        } catch (err: any) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `[ADO Error] ${err.message}` }],
          };
        }
      },
    );
  }

  const skipped = tools.length - selected.length;
  console.error(
    `✅ [ADO] ${selected.length} tools registrados desde Azure DevOps MCP` +
      (skipped ? ` (${skipped} omitidos por ADO_TOOLS).` : "."),
  );
}
