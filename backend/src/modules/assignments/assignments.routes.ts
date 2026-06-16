import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticate);

const MANAGE = ["SUPER_ADMIN", "ADMIN", "DEAN"] as const;

/** Options for the management screen: sections, subjects, teaching staff. */
assignmentsRouter.get(
  "/options",
  requireRole(...MANAGE),
  asyncHandler(async (_req, res) => {
    const [sections, subjects, teachers] = await Promise.all([
      prisma.section.findMany({
        include: { class: true },
        orderBy: [{ class: { order: "asc" } }, { name: "asc" }],
      }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
      prisma.teacher.findMany({
        where: { isActive: true, staffType: "TEACHING" },
        orderBy: { employeeNo: "asc" },
      }),
    ]);
    res.json({
      sections: sections.map((s) => ({ id: s.id, label: `${s.class.name} · ${s.name}` })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
      teachers: teachers.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        employeeNo: t.employeeNo,
      })),
    });
  })
);

/** Assignments for a section. */
assignmentsRouter.get(
  "/",
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const sectionId = req.query.sectionId as string | undefined;
    if (!sectionId) return res.json({ items: [] });
    const items = await prisma.teachingAssignment.findMany({
      where: { sectionId },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: { subject: { name: "asc" } },
    });
    res.json({
      items: items.map((a) => ({
        id: a.id,
        subjectId: a.subjectId,
        subject: a.subject.name,
        teacherId: a.teacherId,
        teacher: `${a.teacher.firstName} ${a.teacher.lastName}`,
      })),
    });
  })
);

const upsertSchema = z.object({
  sectionId: z.string(),
  subjectId: z.string(),
  teacherId: z.string(),
});

/** Assign (or change) the teacher for a subject in a section. */
assignmentsRouter.post(
  "/",
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { sectionId, subjectId, teacherId } = upsertSchema.parse(req.body);
    const assignment = await prisma.teachingAssignment.upsert({
      where: { sectionId_subjectId: { sectionId, subjectId } },
      update: { teacherId },
      create: { sectionId, subjectId, teacherId },
    });
    res.status(201).json(assignment);
  })
);

// Assign one teacher to EVERY subject in a section (primary-grade shortcut).
const bulkSchema = z.object({ sectionId: z.string(), teacherId: z.string() });
assignmentsRouter.post(
  "/all",
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { sectionId, teacherId } = bulkSchema.parse(req.body);
    const subjects = await prisma.subject.findMany({ select: { id: true } });
    for (const s of subjects) {
      await prisma.teachingAssignment.upsert({
        where: { sectionId_subjectId: { sectionId, subjectId: s.id } },
        update: { teacherId },
        create: { sectionId, subjectId: s.id, teacherId },
      });
    }
    res.json({ ok: true, count: subjects.length });
  })
);

assignmentsRouter.delete(
  "/:id",
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const exists = await prisma.teachingAssignment.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("Assignment not found");
    await prisma.teachingAssignment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
