import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";
import type { Tenant } from "../config/tenants";

// Per-request tenant context. The hostname resolver populates this before any
// route runs, so the rest of the request (and the `prisma` proxy + auth) can
// pick up the right school without threading it through every function.
export interface TenantContext {
  tenant: Tenant;
  prisma: PrismaClient;
}

export const tenantStore = new AsyncLocalStorage<TenantContext>();

/** The current request's tenant, or undefined if outside a tenant context. */
export function currentTenant(): Tenant | undefined {
  return tenantStore.getStore()?.tenant;
}

/** Like currentTenant() but throws if there is no context (server bug / misroute). */
export function requireTenant(): TenantContext {
  const ctx = tenantStore.getStore();
  if (!ctx) {
    throw new Error(
      "No tenant context — this request reached tenant-scoped code without a resolved school."
    );
  }
  return ctx;
}
