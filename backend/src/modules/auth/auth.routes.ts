import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, signToken } from "../../middleware/auth";
import { isProd } from "../../config/env";
import { audit, logAudit } from "../../lib/audit";

export const authRouter = Router();

// httpOnly session cookie — not readable by JavaScript (mitigates token theft via XSS).
const COOKIE_NAME = "token";
const cookieOptions = {
  httpOnly: true,
  secure: isProd, // HTTPS only in production
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT expiry
};

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

    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    // Token goes in the httpOnly cookie, not the response body.
    res.cookie(COOKIE_NAME, token, cookieOptions);
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

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" });
  res.json({ ok: true });
});

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
    audit(req, "auth.password_change", "Changed their password");
    res.json({ ok: true });
  })
);
