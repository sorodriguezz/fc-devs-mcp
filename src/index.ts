#!/usr/bin/env node

const _origWrite = process.stdout.write.bind(process.stdout);
(process.stdout.write as unknown) = (chunk: string | Uint8Array): boolean =>
  process.stderr.write(chunk);

const { McpApplication } = await import("./server/McpApplication.js");

process.stdout.write = _origWrite;

new McpApplication().start().catch((err: Error) => {
  console.error(`💥 [MCP] Error fatal al iniciar el servidor: ${err.message}`);
  process.exit(1);
});
