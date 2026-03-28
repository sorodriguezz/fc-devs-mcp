export interface Closeable {
  close(): Promise<void>;
}

export class GracefulShutdown {
  private readonly resources: Closeable[] = [];
  private isShuttingDown = false;

  register(resource: Closeable): this {
    this.resources.push(resource);
    return this;
  }

  install(onTransportClose: (handler: () => void) => void): void {
    process.on("SIGINT", () => void this.shutdown("SIGINT"));
    process.on("SIGTERM", () => void this.shutdown("SIGTERM"));

    process.on("uncaughtException", async (err) => {
      console.error(`💥 [MCP] uncaughtException: ${err.message}`, err.stack);
      await this.shutdown("uncaughtException");
    });

    process.on("unhandledRejection", async (reason) => {
      console.error(`💥 [MCP] unhandledRejection:`, reason);
      await this.shutdown("unhandledRejection");
    });

    onTransportClose(() => void this.shutdown("transport closed"));
  }

  async shutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.error(`\n🛑 [MCP] Shutdown iniciado (${reason}). Cerrando recursos...`);

    for (const resource of [...this.resources].reverse()) {
      try {
        await resource.close();
      } catch (err: any) {
        console.error(`⚠️  [MCP] Error al cerrar recurso: ${err.message}`);
      }
    }

    console.error("👋 [MCP] Servidor detenido correctamente.");
    process.exit(0);
  }
}
