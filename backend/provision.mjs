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
import { writeFileSync, mkdirSync } from "node:fs";
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
};

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
JWT_SECRET=${randomBytes(24).toString("hex")}
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

console.log(`\n✅ "${cfg.name}" is provisioned.`);
console.log(`   Admin login: ${cfg.admin} / ${cfg.password}`);
console.log(`   Run it:      cd backend && env $(cat ${envPath} | grep -v '^#' | xargs) npm start`);
console.log(`   Or deploy:   docker compose --env-file ${envPath} -f docker-compose.school.yml up -d\n`);
