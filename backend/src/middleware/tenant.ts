import type { NextFunction, Request, Response } from "express";
import { resolveTenant } from "../config/tenants";
import { prismaFor } from "../lib/prisma";
import { tenantStore } from "../lib/tenant-context";

// Resolve which school a request belongs to from its hostname, then run the rest
// of the request inside that tenant's context (its DB client + secret). Mounted
// before every route, so `prisma`, auth, and handlers all see the right school.
export function resolveTenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenant = resolveTenant(req.hostname);

  if (!tenant) {
    // Health check must work on any hostname (load balancers, uptime pings).
    if (req.path === "/api/health") return next();
    // Unknown school domain hitting the API → clear error rather than a crash.
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Unknown school domain." });
    }
    // Non-API (e.g. SPA assets) on an unknown host → let static handling deal with it.
    return next();
  }

  const ctx = { tenant, prisma: prismaFor(tenant.databaseUrl) };
  tenantStore.run(ctx, next);
}
