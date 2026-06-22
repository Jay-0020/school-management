import { PrismaClient } from "@prisma/client";
import { requireTenant } from "./tenant-context";

// ── Per-tenant Prisma ─────────────────────────────────────────────────────
// This app serves many schools, each with its own database. We keep one
// PrismaClient per database URL (each holds its own connection pool) and reuse
// it across requests. The hostname resolver picks the right client per request
// and stashes it in the tenant context.

const clients = new Map<string, PrismaClient>();

/** Get (or lazily create + cache) the Prisma client for a given database URL. */
export function prismaFor(databaseUrl: string): PrismaClient {
  let client = clients.get(databaseUrl);
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
    clients.set(databaseUrl, client);
  }
  return client;
}

/** Disconnect every cached client (graceful shutdown). */
export async function disconnectAll(): Promise<void> {
  await Promise.all([...clients.values()].map((c) => c.$disconnect()));
  clients.clear();
}

// The 27 feature modules do `import { prisma } from "../../lib/prisma"` and then
// `prisma.user.findMany()`. Rather than rewrite all of them, `prisma` is a Proxy
// that forwards every access to the *current request's* tenant client. So the
// same `prisma.foo.bar()` call transparently hits whichever school the request
// resolved to — no module changes needed.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const { prisma: client } = requireTenant();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
