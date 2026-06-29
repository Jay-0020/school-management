import { createApp } from "./app";
import { env } from "./config/env";
import { tenantCount } from "./config/tenants";
import { disconnectAll } from "./lib/prisma";

async function main() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`🏫 Serving ${tenantCount()} school(s) from the tenant registry`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close();
    await disconnectAll();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // One app serves every school, so a single stray error must not crash the
  // whole fleet. A rejection that escapes a request is logged and the process
  // keeps serving; a truly uncaught exception leaves the process in an unknown
  // state, so we log and exit for the process manager (Docker) to restart clean.
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception — exiting for a clean restart:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
