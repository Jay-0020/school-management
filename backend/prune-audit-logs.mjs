#!/usr/bin/env node
// Prune old AuditLog rows from EVERY school database in the tenant registry.
//
//   npm run prune:audit            # delete entries older than 365 days
//   AUDIT_RETENTION_DAYS=180 npm run prune:audit
//
// AuditLog is append-only and the one table that grows without bound, so it
// needs periodic pruning. Run this on a cron (e.g. weekly). Mirrors
// migrate-all-tenants.mjs: reads backend/tenants.json (or $TENANTS_FILE), or
// falls back to $DATABASE_URL for a single-school deploy. Exits non-zero if any
// database fails.
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const here = dirname(fileURLToPath(import.meta.url));
const registryPath = process.env.TENANTS_FILE || join(here, "tenants.json");
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || 365);

function loadTargets() {
  if (existsSync(registryPath)) {
    const reg = JSON.parse(readFileSync(registryPath, "utf8"));
    const tenants = Array.isArray(reg.tenants) ? reg.tenants : [];
    if (tenants.length) {
      return tenants.map((t) => ({ label: t.host || t.db || "?", databaseUrl: t.databaseUrl }));
    }
  }
  if (process.env.DATABASE_URL) {
    return [{ label: "env (single-tenant)", databaseUrl: process.env.DATABASE_URL }];
  }
  return [];
}

const targets = loadTargets();
if (!targets.length) {
  console.error("No tenants to prune — no tenants.json with entries, and no DATABASE_URL set.");
  process.exit(1);
}

const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
console.log(`\n▶ Pruning AuditLog older than ${RETENTION_DAYS}d (before ${cutoff.toISOString().slice(0, 10)}) across ${targets.length} database(s)\n`);

const failed = [];
for (const t of targets) {
  if (!t.databaseUrl) {
    console.error(`  ✗ ${t.label}: missing databaseUrl — skipped`);
    failed.push(t.label);
    continue;
  }
  const prisma = new PrismaClient({ datasources: { db: { url: t.databaseUrl } } });
  try {
    const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    console.log(`  ✓ ${t.label}: pruned ${count} row(s)`);
  } catch (e) {
    console.log(`  ✗ ${t.label}`);
    console.error("    " + String(e?.message || e).split("\n").slice(-2).join("\n    "));
    failed.push(t.label);
  } finally {
    await prisma.$disconnect();
  }
}

if (failed.length) {
  console.error(`\n❌ ${failed.length}/${targets.length} failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
console.log(`\n✅ Pruned AuditLog on all ${targets.length} database(s).\n`);
