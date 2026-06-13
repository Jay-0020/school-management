import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, signToken } from "../../middleware/auth";

export const authRouter = Router();

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
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
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
    res.json({ ok: true });
  })
);
