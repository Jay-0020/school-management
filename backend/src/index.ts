import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function main() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
