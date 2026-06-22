#!/usr/bin/env node
// One-command provisioning for a new white-label school instance.
//
//   node provision.mjs \
//     --name "Springfield High" --short SHS --color "#7c3aed" \
//     --email info@springfield.edu --phone "+91-9000000000" \
//     --admin admin@springfield.edu --password "Temp@1234" \
//     --db school_springfield [--port 4001] [--logo https://…/logo.png]
//
// It creates the school's database, applies migrations, and seeds its branded
// SchoolSettings + admin login. Writes instances/<db>.env you can run/deploy.
//
// Requires Postgres client tools (psql) on PATH (or set PSQL=/path/to/psql),
// and a Postgres role that can CREATE DATABASE. Defaults to the dev role
// school/school @ localhost:5432.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PSQL = process.env.PSQL || "psql";
const PGHOST = process.env.PGHOST || "localhost";
const PGPORT = process.env.PGPORT || "5432";
const PGUSER = process.env.PGUSER || "school";
const PGPASSWORD = process.env.PGPASSWORD || "school";

// ── args ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
const a = parseArgs(process.argv.slice(2));

const required = ["name", "admin", "db"];
const missing = required.filter((k) => !a[k]);
if (missing.length) {
  console.error(`Missing required flag(s): ${missing.map((m) => "--" + m).join(", ")}`);
  console.error("Required: --name --admin --db   (see header for the full list)");
  process.exit(1);
}
if (!/^[a-z0-9_]+$/.test(a.db)) {
  console.error("--db must be a safe identifier (lowercase letters, digits, underscores)");
  process.exit(1);
}

const cfg = {
  name: a.name,
  short: a.short || a.name.slice(0, 3).toUpperCase(),
  color: a.color || "#1d4ed8",
  logo: a.logo || "",
  email: a.email || "",
  phone: a.phone || "",
  admin: a.admin,
  password: a.password || "ChangeMe!123",
  db: a.db,
  port: a.port || "4000",
  // Hostname this school is reached at. Defaults to a *.localhost subdomain
  // derived from the db name (school_springfield → springfield.localhost) for
  // local/dev; pass --host the real domain in production.
  host: a.host || `${a.db.replace(/^school_/, "")}.localhost`,
};

// One stable per-school JWT secret, shared by the .env and the tenant registry.
const jwtSecret = randomBytes(24).toString("hex");

const baseUrl = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}`;
const dbUrl = `${baseUrl}/${cfg.db}?schema=public`;
const psql = (db, sql) =>
  execSync(`${PSQL} "${baseUrl}/${db}" -tAc "${sql.replace(/"/g, '\\"')}"`, {
    stdio: ["ignore", "pipe", "pipe"],
  })
    .toString()
    .trim();

console.log(`\n▶ Provisioning "${cfg.name}" → database "${cfg.db}"\n`);

// 1. Create the database (idempotent).
const exists = psql("postgres", `SELECT 1 FROM pg_database WHERE datname='${cfg.db}'`);
if (exists === "1") {
  console.log(`  • database "${cfg.db}" already exists — reusing`);
} else {
  psql("postgres", `CREATE DATABASE "${cfg.db}" OWNER ${PGUSER}`);
  console.log(`  ✓ created database "${cfg.db}"`);
}

// 2. Write the instance env file (note: hex colour is quoted — dotemv treats # as a comment).
const env = `# Generated for ${cfg.name}
NODE_ENV=production
PORT=${cfg.port}
DATABASE_URL=${dbUrl}
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d
SCHOOL_NAME=${cfg.name}
SCHOOL_SHORT_NAME=${cfg.short}
SCHOOL_PRIMARY_COLOR="${cfg.color}"
SCHOOL_LOGO_URL=${cfg.logo}
SCHOOL_CONTACT_EMAIL=${cfg.email}
SCHOOL_CONTACT_PHONE=${cfg.phone}
SCHOOL_CURRENCY=INR
SCHOOL_TIMEZONE=Asia/Kolkata
SEED_ADMIN_EMAIL=${cfg.admin}
SEED_ADMIN_PASSWORD=${cfg.password}
`;
const instancesDir = join(here, "instances");
mkdirSync(instancesDir, { recursive: true });
const envPath = join(instancesDir, `${cfg.db}.env`);
writeFileSync(envPath, env);
console.log(`  ✓ wrote ${envPath}`);

// 3. Apply migrations + seed branding/admin against the new DB.
const runEnv = { ...process.env, DATABASE_URL: dbUrl };
const seedEnv = {
  ...runEnv,
  JWT_SECRET: "provisioning-temp-secret",
  SCHOOL_NAME: cfg.name,
  SCHOOL_SHORT_NAME: cfg.short,
  SCHOOL_PRIMARY_COLOR: cfg.color,
  SCHOOL_LOGO_URL: cfg.logo,
  SCHOOL_CONTACT_EMAIL: cfg.email,
  SCHOOL_CONTACT_PHONE: cfg.phone,
  SEED_ADMIN_EMAIL: cfg.admin,
  SEED_ADMIN_PASSWORD: cfg.password,
};
console.log("  • applying migrations…");
execSync("npx prisma migrate deploy", { cwd: here, env: runEnv, stdio: "ignore" });
console.log("  • seeding branding + admin…");
execSync("npx tsx prisma/seed.ts", { cwd: here, env: seedEnv, stdio: "ignore" });

// 4. Register the school in the tenant registry (tenants.json) — the single app
//    reads this to route requests by hostname to this school's DB. Idempotent:
//    re-provisioning the same db updates its entry in place.
const registryPath = join(here, "tenants.json");
const registry = existsSync(registryPath)
  ? JSON.parse(readFileSync(registryPath, "utf8"))
  : { tenants: [] };
const entry = { host: cfg.host, db: cfg.db, databaseUrl: dbUrl, jwtSecret, name: cfg.name };
const idx = registry.tenants.findIndex((t) => t.db === cfg.db || t.host === cfg.host);
if (idx >= 0) registry.tenants[idx] = entry;
else registry.tenants.push(entry);
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`  ✓ registered tenant "${cfg.host}" in tenants.json`);

console.log(`\n✅ "${cfg.name}" is provisioned and registered.`);
console.log(`   Admin login: ${cfg.admin} / ${cfg.password}`);
console.log(`   Reached at:  http://${cfg.host}:${cfg.port}`);
console.log(`   Run it:      cd backend && npm start   (one app serves every registered school)`);
console.log(`   No redeploy needed to add a school — it's live as soon as it's in tenants.json.\n`);
