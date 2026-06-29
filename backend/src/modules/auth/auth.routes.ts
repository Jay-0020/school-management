import { Router } from "express";
import type { Request } from "express";
import crypto from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, signToken } from "../../middleware/auth";
import { audit, logAudit } from "../../lib/audit";

export const authRouter = Router();

// Short-lived access token + long-lived ROTATING refresh token, both in
// httpOnly cookies (not readable by JS). The access token expires quickly so a
// stolen one is short-lived; the refresh token is tracked in the DB so sessions
// are revocable (logout, force-logout).
const ACCESS_COOKIE = "token";
const REFRESH_COOKIE = "refresh_token";
const ACCESS_TTL = "1h";
const ACCESS_MAX_AGE = 60 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Cookie flags are derived per-request: `secure` follows the ACTUAL transport
// (req.secure honours X-Forwarded-Proto behind the trusted proxy), not NODE_ENV.
// So cookies are Secure whenever we're really on HTTPS — and a prod box that
// forgot to set NODE_ENV no longer silently ships session cookies in the clear.
function cookieOpts(req: Request) {
  const secure = req.secure;
  return {
    access: { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: ACCESS_MAX_AGE },
    refresh: { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth", maxAge: REFRESH_TTL_MS },
    clearAccess: { httpOnly: true, secure, sameSite: "lax" as const, path: "/" },
    clearRefresh: { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth" },
  };
}

const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");
const readCookie = (req: { cookies?: Record<string, string> }, name: string) => req.cookies?.[name];

/** Persist a rotating refresh token; return the raw value for the cookie. */
async function issueRefresh(userId: string, userAgent?: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: userAgent ?? null,
    },
  });
  return raw;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw ApiError.unauthorized("Invalid credentials");

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw ApiError.unauthorized("Invalid credentials");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Access token in a short-lived cookie; refresh token in its own cookie.
    const c = cookieOpts(req);
    const access = signToken({ sub: user.id, role: user.role, email: user.email, mcp: user.mustChangePassword }, ACCESS_TTL);
    res.cookie(ACCESS_COOKIE, access, c.access);
    const refresh = await issueRefresh(user.id, req.headers["user-agent"]);
    res.cookie(REFRESH_COOKIE, refresh, c.refresh);
    logAudit({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "auth.login",
      summary: "Signed in",
      ip: req.ip,
    });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  })
);

/** Rotate the refresh token and mint a fresh access token. */
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (!raw) throw ApiError.unauthorized("No refresh token");
    const rt = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: true },
    });
    const c = cookieOpts(req);
    if (!rt || rt.revokedAt || rt.expiresAt < new Date() || !rt.user.isActive) {
      res.clearCookie(ACCESS_COOKIE, c.clearAccess);
      res.clearCookie(REFRESH_COOKIE, c.clearRefresh);
      throw ApiError.unauthorized("Invalid refresh token");
    }
    // Rotate: revoke the used token, issue a new one.
    await prisma.refreshToken.update({ where: { id: rt.id }, data: { revokedAt: new Date() } });
    const newRaw = await issueRefresh(rt.userId, req.headers["user-agent"]);
    res.cookie(REFRESH_COOKIE, newRaw, c.refresh);
    const access = signToken({ sub: rt.user.id, role: rt.user.role, email: rt.user.email, mcp: rt.user.mustChangePassword }, ACCESS_TTL);
    res.cookie(ACCESS_COOKIE, access, c.access);
    res.json({
      user: {
        id: rt.user.id,
        email: rt.user.email,
        role: rt.user.role,
        mustChangePassword: rt.user.mustChangePassword,
      },
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const raw = readCookie(req, REFRESH_COOKIE);
    if (raw) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const c = cookieOpts(req);
    res.clearCookie(ACCESS_COOKIE, c.clearAccess);
    res.clearCookie(REFRESH_COOKIE, c.clearRefresh);
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        mustChangePassword: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw ApiError.notFound("User not found");
    res.json({ user });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

authRouter.post(
  "/change-password",
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw ApiError.notFound("User not found");

    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw ApiError.badRequest("Current password is incorrect");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(newPassword),
        mustChangePassword: false,
      },
    });

    // Revoke every existing refresh token for this user (force-logout everywhere)
    // — a password change should end all other sessions. Then re-issue THIS
    // session with fresh cookies (mcp now cleared) so the current device stays in.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const c = cookieOpts(req);
    const access = signToken({ sub: user.id, role: user.role, email: user.email, mcp: false }, ACCESS_TTL);
    res.cookie(ACCESS_COOKIE, access, c.access);
    const refresh = await issueRefresh(user.id, req.headers["user-agent"]);
    res.cookie(REFRESH_COOKIE, refresh, c.refresh);

    audit(req, "auth.password_change", "Changed their password");
    res.json({ ok: true });
  })
);
