import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const noticesRouter = Router();

noticesRouter.use(authenticate);

const authorSelect = {
  author: { select: { id: true, email: true, role: true } },
  section: { select: { id: true, name: true, class: { select: { name: true } } } },
} satisfies Prisma.NoticeInclude;

/**
 * Notices visible to the current user, pinned first then newest.
 * - ADMIN/SUPER_ADMIN: everything.
 * - STAFF roles (TEACHER/ACCOUNTANT): ALL + STAFF + any SECTION notice.
 * - STUDENT: ALL + STUDENTS + notices for their own section.
 * - PARENT: ALL + STUDENTS.
 */
noticesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    let where: Prisma.NoticeWhereInput = {};

    if (role === "TEACHER" || role === "ACCOUNTANT") {
      where = { audience: { in: ["ALL", "STAFF", "SECTION"] } };
    } else if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      const ors: Prisma.NoticeWhereInput[] = [
        { audience: { in: ["ALL", "STUDENTS"] } },
      ];
      if (student?.sectionId) {
        ors.push({ audience: "SECTION", sectionId: student.sectionId });
      }
      where = { OR: ors };
    } else if (role === "PARENT") {
      where = { audience: { in: ["ALL", "STUDENTS"] } };
    }
    // ADMIN / SUPER_ADMIN: where stays {} (all notices)

    const notices = await prisma.notice.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: authorSelect,
    });
    res.json({ items: notices });
  })
);

const bodySchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    audience: z.enum(["ALL", "STUDENTS", "STAFF", "SECTION"]),
    sectionId: z.string().nullish(),
    pinned: z.boolean().optional(),
  })
  .refine((d) => d.audience !== "SECTION" || !!d.sectionId, {
    message: "A section is required when audience is SECTION",
    path: ["sectionId"],
  });

noticesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const data = bodySchema.parse(req.body);
    const notice = await prisma.notice.create({
      data: {
        title: data.title,
        body: data.body,
        audience: data.audience,
        sectionId: data.audience === "SECTION" ? data.sectionId! : null,
        pinned: data.pinned ?? false,
        authorId: req.user!.sub,
      },
      include: authorSelect,
    });
    res.status(201).json(notice);
  })
);

noticesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.notice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Notice not found");
    // Teachers may only edit their own notices; admins may edit any.
    const { role, sub } = req.user!;
    if (role === "TEACHER" && existing.authorId !== sub) throw ApiError.forbidden();

    const data = bodySchema.parse(req.body);
    const notice = await prisma.notice.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        body: data.body,
        audience: data.audience,
        sectionId: data.audience === "SECTION" ? data.sectionId! : null,
        pinned: data.pinned ?? false,
      },
      include: authorSelect,
    });
    res.json(notice);
  })
);

noticesRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.notice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Notice not found");
    const { role, sub } = req.user!;
    if (role === "TEACHER" && existing.authorId !== sub) throw ApiError.forbidden();

    await prisma.notice.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
