import { SocketModeClient } from "@slack/socket-mode";
import { Hono } from "hono";
import { getConfig } from "./config";
import { closeDb, getDb, runMigrations } from "./db/index";
import { logger } from "./logger";
import { handleSlashCommand, handleViewSubmission } from "./slack/routes";

const log = logger.child({ module: "main" });

async function main() {
  const config = getConfig();

  const db = getDb();
  await runMigrations(db);
  log.info("Migrations complete");

  const app = new Hono();
  app.get("/health", async (c) => {
    try {
      await db`SELECT 1`;
      return c.json({ status: "ok" });
    } catch {
      return c.json({ status: "error", detail: "db" }, 503);
    }
  });

  const server = Bun.serve({
    port: config.PORT,
    fetch: app.fetch,
  });
  log.info({ port: config.PORT }, "Health server started");

  const socketMode = new SocketModeClient({ appToken: config.SLACK_APP_TOKEN });

  socketMode.on(
    "slash_commands",
    async ({
      body,
      ack,
    }: {
      body: Record<string, string>;
      ack: (r?: Record<string, unknown>) => Promise<void>;
    }) => {
      await handleSlashCommand(body, ack);
    },
  );

  socketMode.on(
    "interactive",
    async ({
      body,
      ack,
    }: {
      body: Record<string, unknown>;
      ack: (r?: Record<string, unknown>) => Promise<void>;
    }) => {
      if (body.type === "view_submission") {
        await handleViewSubmission(body, ack);
      } else {
        await ack();
      }
    },
  );

  await socketMode.start();
  log.info("Socket Mode connected");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "Shutting down");

    server.stop();
    await socketMode.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await closeDb();

    log.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  log.fatal({ error: err }, "Failed to start");
  process.exit(1);
});
