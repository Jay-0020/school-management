import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { ApiError } from "../lib/http";
import { requireTenant } from "../lib/tenant-context";

export interface AuthPayload {
  sub: string; // user id
  role: Role;
  email: string;
  mcp?: boolean; // must change password — gates the API until they do
}

// While a forced password change is pending, only these endpoints are reachable.
const PW_CHANGE_ALLOWED = new Set([
  "/api/auth/change-password",
  "/api/auth/me",
  "/api/auth/logout",
]);

// Attach the authenticated user to the request.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(
  payload: AuthPayload,
  expiresIn: string = env.JWT_EXPIRES_IN
): string {
  const options: jwt.SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  };
  // Per-tenant secret: a token minted for one school can't be verified against
  // another, so tokens never cross tenants even if user ids happen to collide.
  return jwt.sign(payload, requireTenant().tenant.jwtSecret, options);
}

/** Requires a valid token; populates req.user.
 *  Prefers the httpOnly cookie (browser); falls back to a Bearer header (API/CLI). */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookieToken = (req as { cookies?: Record<string, string> }).cookies?.token;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : cookieToken;
  if (!token) throw ApiError.unauthorized("Missing authentication");
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, requireTenant().tenant.jwtSecret) as AuthPayload;
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
  req.user = payload;
  // Enforce a pending password change server-side: a user flagged
  // mustChangePassword can't use the API (beyond changing it) — so a
  // temporary/seeded password is not a usable session.
  if (payload.mcp) {
    const path = (req.originalUrl.split("?")[0] || "/").replace(/\/+$/, "") || "/";
    if (!PW_CHANGE_ALLOWED.has(path)) {
      throw ApiError.forbidden("You must change your password before continuing.");
    }
  }
  next();
}

/** Requires the authenticated user to hold one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
