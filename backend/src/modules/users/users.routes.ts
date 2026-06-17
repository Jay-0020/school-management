import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { audit } from "../../lib/audit";

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN"));

const userSelect = {
  id: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  casualQuota: true,
  sickQuota: true,
  lastLoginAt: true,
  createdAt: true,
  teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
  student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
} as const;

const ROLES = ["SUPER_ADMIN", "ADMIN", "DEAN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"] as const;

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const role = req.query.role;
    const status = req.query.status; // "active" | "inactive"

    const where: NonNullable<Parameters<typeof prisma.user.findMany>[0]>["where"] = {};
    if (typeof role === "string" && (ROLES as readonly string[]).includes(role)) {
      where.role = role as (typeof ROLES)[number];
    }
    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { teacher: { firstName: { contains: search, mode: "insensitive" } } },
        { teacher: { lastName: { contains: search, mode: "insensitive" } } },
        { teacher: { employeeNo: { contains: search, mode: "insensitive" } } },
        { student: { firstName: { contains: search, mode: "insensitive" } } },
        { student: { lastName: { contains: search, mode: "insensitive" } } },
        { student: { admissionNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: userSelect,
    });
    res.json({ items: users });
  })
);

const createSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"]),
    teacherId: z.string().nullish(),
    studentId: z.string().nullish(),
    childId: z.string().nullish(), // for PARENT: the student they're a parent of
  })
  .refine((d) => !(d.teacherId && d.studentId), {
    message: "Link to a teacher or a student, not both",
    path: ["teacherId"],
  })
  .refine((d) => !d.teacherId || d.role === "TEACHER", {
    message: "Teacher link requires the TEACHER role",
    path: ["role"],
  })
  .refine((d) => !d.studentId || d.role === "STUDENT", {
    message: "Student link requires the STUDENT role",
    path: ["role"],
  })
  .refine((d) => !d.childId || d.role === "PARENT", {
    message: "Child link requires the PARENT role",
    path: ["role"],
  });

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);

    const emailTaken = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailTaken) throw ApiError.conflict("Email already in use");

    if (data.teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: data.teacherId } });
      if (!t) throw ApiError.notFound("Teacher not found");
      if (t.userId) throw ApiError.conflict("That teacher already has a login");
    }
    if (data.studentId) {
      const s = await prisma.student.findUnique({ where: { id: data.studentId } });
      if (!s) throw ApiError.notFound("Student not found");
      if (s.userId) throw ApiError.conflict("That student already has a login");
    }
    if (data.childId) {
      const c = await prisma.student.findUnique({ where: { id: data.childId } });
      if (!c) throw ApiError.notFound("Student (child) not found");
    }

    const passwordHash = await argon2.hash(data.password);

    const userId = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: data.role,
          mustChangePassword: true,
        },
      });
      if (data.teacherId) {
        await tx.teacher.update({
          where: { id: data.teacherId },
          data: { userId: created.id },
        });
      }
      if (data.studentId) {
        await tx.student.update({
          where: { id: data.studentId },
          data: { userId: created.id },
        });
      }
      if (data.childId) {
        await tx.student.update({
          where: { id: data.childId },
          data: { parentId: created.id },
        });
      }
      return created.id;
    });

    // Re-read so the response reflects the link that was just created.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    audit(req, "user.create", `Created user ${user?.email} (${user?.role})`, { type: "User", id: user?.id });
    res.status(201).json(user);
  })
);

const resetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

usersRouter.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const { newPassword } = resetSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw ApiError.notFound("User not found");
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(newPassword), mustChangePassword: true },
    });
    audit(req, "user.reset_password", `Reset password for ${user.email}`, { type: "User", id: user.id });
    res.json({ ok: true });
  })
);

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  casualQuota: z.number().int().min(0).max(365).optional(),
  sickQuota: z.number().int().min(0).max(365).optional(),
});

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = patchSchema.parse(req.body);
    if (req.params.id === req.user!.sub && data.isActive === false) {
      throw ApiError.badRequest("You can't deactivate your own account");
    }
    const exists = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("User not found");
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect,
    });
    audit(req, "user.update", `Updated user ${exists.email}`, { type: "User", id: exists.id });
    res.json(user);
  })
);

usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.sub) {
      throw ApiError.badRequest("You can't delete your own account");
    }
    const exists = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("User not found");
    // Optional relations (teacher/student/notice) are set null on delete.
    await prisma.user.delete({ where: { id: req.params.id } });
    audit(req, "user.delete", `Deleted user ${exists.email}`, { type: "User", id: exists.id });
    res.status(204).end();
  })
);
