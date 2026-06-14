import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const schoolworkRouter = Router();

schoolworkRouter.use(authenticate);

const STAFF = ["SUPER_ADMIN", "ADMIN", "TEACHER"] as const;

// ── Subjects ────────────────────────────────────────────────────────────────
schoolworkRouter.get(
  "/subjects",
  asyncHandler(async (_req, res) => {
    const items = await prisma.subject.findMany({ orderBy: { name: "asc" } });
    res.json({ items });
  })
);

const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullish(),
});

schoolworkRouter.post(
  "/subjects",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = subjectSchema.parse(req.body);
    const clash = await prisma.subject.findUnique({ where: { name: data.name } });
    if (clash) throw ApiError.conflict("A subject with that name already exists");
    const created = await prisma.subject.create({
      data: { name: data.name, code: data.code ?? null },
    });
    res.status(201).json(created);
  })
);

schoolworkRouter.delete(
  "/subjects/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const used = await prisma.homework.count({ where: { subjectId: req.params.id } });
    if (used > 0) throw ApiError.badRequest("Subject is used by existing homework");
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

// ── Homework ────────────────────────────────────────────────────────────────
const homeworkInclude = {
  subject: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, class: { select: { name: true } } } },
  assignedBy: { select: { id: true, email: true } },
} satisfies Prisma.HomeworkInclude;

schoolworkRouter.get(
  "/homework",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const where: Prisma.HomeworkWhereInput = {};

    if (role === "STUDENT" || role === "PARENT") {
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      where.sectionId = student?.sectionId ?? "__none__";
    } else {
      if (req.query.sectionId) where.sectionId = String(req.query.sectionId);
      if (req.query.subjectId) where.subjectId = String(req.query.subjectId);
    }

    const items = await prisma.homework.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: homeworkInclude,
    });
    res.json({ items });
  })
);

const homeworkSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().nullish(),
  dueDate: z.coerce.date().nullish(),
});

schoolworkRouter.post(
  "/homework",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const data = homeworkSchema.parse(req.body);
    const section = await prisma.section.findUnique({ where: { id: data.sectionId } });
    if (!section) throw ApiError.notFound("Section not found");

    const homework = await prisma.homework.create({
      data: {
        title: data.title,
        description: data.description,
        sectionId: data.sectionId,
        subjectId: data.subjectId ?? null,
        dueDate: data.dueDate ?? null,
        assignedById: req.user!.sub,
      },
      include: homeworkInclude,
    });
    res.status(201).json(homework);
  })
);

schoolworkRouter.patch(
  "/homework/:id",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const existing = await prisma.homework.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Homework not found");
    const { role, sub } = req.user!;
    if (role === "TEACHER" && existing.assignedById !== sub) throw ApiError.forbidden();

    const data = homeworkSchema.parse(req.body);
    const homework = await prisma.homework.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        description: data.description,
        sectionId: data.sectionId,
        subjectId: data.subjectId ?? null,
        dueDate: data.dueDate ?? null,
      },
      include: homeworkInclude,
    });
    res.json(homework);
  })
);

schoolworkRouter.delete(
  "/homework/:id",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const existing = await prisma.homework.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Homework not found");
    const { role, sub } = req.user!;
    if (role === "TEACHER" && existing.assignedById !== sub) throw ApiError.forbidden();

    await prisma.homework.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
