#!/usr/bin/env node
// Apply pending Prisma migrations to EVERY school database in the tenant registry.
//
//   npm run migrate:all
//
// In the multi-tenant model each school has its own database, so a release that
// includes a new migration must be deployed to ALL of them — this loops the
// registry (tenants.json) and runs `prisma migrate deploy` against each DB.
//
// Reads backend/tenants.json (or $TENANTS_FILE). If there's no registry but
// $DATABASE_URL is set (a single-school / fallback deploy), it migrates that one
// database. Exits non-zero if any migration fails — wire it into the deploy
// pipeline AFTER the new image is built and BEFORE/at release.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const registryPath = process.env.TENANTS_FILE || join(here, "tenants.json");

function loadTargets() {
  if (existsSync(registryPath)) {
    const reg = JSON.parse(readFileSync(registryPath, "utf8"));
    const tenants = Array.isArray(reg.tenants) ? reg.tenants : [];
    if (tenants.length) {
      return tenants.map((t) => ({ label: t.host || t.db || "?", databaseUrl: t.databaseUrl }));
    }
  }
  // Single-school / fallback deploy: no registry, but a DATABASE_URL is set.
  if (process.env.DATABASE_URL) {
    return [{ label: "env (single-tenant)", databaseUrl: process.env.DATABASE_URL }];
  }
  return [];
}

const targets = loadTargets();
if (!targets.length) {
  console.error(
    "No tenants to migrate — no tenants.json with entries, and no DATABASE_URL set."
  );
  process.exit(1);
}

console.log(`\n▶ Applying migrations to ${targets.length} database(s)\n`);
const failed = [];
for (const t of targets) {
  if (!t.databaseUrl) {
    console.error(`  ✗ ${t.label}: missing databaseUrl — skipped`);
    failed.push(t.label);
    continue;
  }
  process.stdout.write(`  • ${t.label} … `);
  try {
    execSync("npx prisma migrate deploy", {
      cwd: here,
      env: { ...process.env, DATABASE_URL: t.databaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log("✓");
  } catch (e) {
    console.log("✗");
    const detail = (e.stderr || e.stdout || e.message || "").toString().trim();
    console.error("    " + detail.split("\n").slice(-3).join("\n    "));
    failed.push(t.label);
  }
}

if (failed.length) {
  console.error(`\n❌ ${failed.length}/${targets.length} failed: ${failed.join(", ")}\n`);
  process.exit(1);
}
console.log(`\n✅ All ${targets.length} database(s) up to date.\n`);
