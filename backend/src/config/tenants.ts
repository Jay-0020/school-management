import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// ── Tenant registry ─────────────────────────────────────────────────────────
// One JSON file (backend/tenants.json) is the source of truth for which schools
// this single app serves and how to reach each one. The provisioner writes/updates
// it; the app loads it at startup and routes requests by hostname.
//
//   {
//     "tenants": [
//       {
//         "host": "springfield.localhost",
//         "db": "school_springfield",
//         "databaseUrl": "postgresql://school:school@localhost:5432/school_springfield?schema=public",
//         "jwtSecret": "…",            // per-school, so tokens don't cross tenants
//         "name": "Springfield High"   // optional, for logs
//       }
//     ]
//   }
//
// Branding (name, colour, logo) still lives in each school's DB (SchoolSettings),
// so the registry only needs routing + secrets.

const tenantSchema = z.object({
  host: z.string().min(1),
  db: z.string().min(1),
  databaseUrl: z.string().min(1),
  jwtSecret: z.string().min(8),
  name: z.string().optional(),
  // Per-school Razorpay account, so online fee payments settle into THIS
  // school's own bank (not one shared account). Optional — online pay is simply
  // disabled for a school until its keys are present.
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  razorpayWebhookSecret: z.string().optional(),
  razorpayConveniencePercent: z.number().optional(),
});

const registrySchema = z.object({
  tenants: z.array(tenantSchema).default([]),
});

export type Tenant = z.infer<typeof tenantSchema>;

const REGISTRY_PATH =
  process.env.TENANTS_FILE || join(__dirname, "..", "..", "tenants.json");

let byHost = new Map<string, Tenant>();

/** Normalise a request hostname to a registry key: lowercase, no port. */
export function normalizeHost(host: string | undefined): string {
  if (!host) return "";
  return host.toLowerCase().split(":")[0].trim();
}

/** (Re)load the registry from disk. Safe to call again to pick up new schools. */
export function loadTenants(): Tenant[] {
  if (!existsSync(REGISTRY_PATH)) {
    byHost = new Map();
    return [];
  }
  const raw = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  const parsed = registrySchema.parse(raw);
  byHost = new Map(parsed.tenants.map((t) => [normalizeHost(t.host), t]));
  return parsed.tenants;
}

// ── Single-tenant fallback (production demo / one-school deploys) ─────────────
// When there's no registry file (e.g. a Render deploy, where tenants.json is
// gitignored and never ships) but a DATABASE_URL is set in the environment, run
// as a single school served on ANY hostname — built from the same env vars the
// old single-tenant deploy used. This lets the multi-tenant code run an existing
// one-school deploy unchanged: same DB, same URL, nothing to configure.
function fallbackTenant(): Tenant | undefined {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  if (!databaseUrl || !jwtSecret || jwtSecret.length < 8) return undefined;
  return {
    host: "*",
    db: "env",
    databaseUrl,
    jwtSecret,
    name: process.env.SCHOOL_NAME || "School",
  };
}

/** True when running off the env fallback (no registry file present). */
export function isSingleTenantFallback(): boolean {
  return byHost.size === 0 && !!fallbackTenant();
}

/** Look up a tenant by request hostname.
 *  - Registry has entries → strict host match (multi-tenant); unknown host → undefined.
 *  - Registry empty + DATABASE_URL set → the env fallback school on any host. */
export function resolveTenant(host: string | undefined): Tenant | undefined {
  if (byHost.size > 0) return byHost.get(normalizeHost(host));
  return fallbackTenant();
}

export function tenantCount(): number {
  return byHost.size > 0 ? byHost.size : fallbackTenant() ? 1 : 0;
}

// Load once on import.
loadTenants();
