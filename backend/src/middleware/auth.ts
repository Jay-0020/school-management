import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { ApiError } from "../lib/http";

export interface AuthPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

// Attach the authenticated user to the request.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/** Requires a valid Bearer token; populates req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
}

/** Requires the authenticated user to hold one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
