import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const classesRouter = Router();

classesRouter.use(authenticate);

// List classes with their sections + student counts (for the setup screen).
classesRouter.get(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const classes = await prisma.class.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        sections: {
          orderBy: { name: "asc" },
          include: {
            classTeacher: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { students: true } },
          },
        },
      },
    });
    res.json({ items: classes });
  })
);

const createClassSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional(),
});

classesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createClassSchema.parse(req.body);
    const existing = await prisma.class.findUnique({ where: { name: data.name } });
    if (existing) throw ApiError.conflict("A class with that name already exists");
    const created = await prisma.class.create({ data });
    res.status(201).json(created);
  })
);

classesRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const sectionCount = await prisma.section.count({
      where: { classId: req.params.id },
    });
    if (sectionCount > 0) {
      throw ApiError.badRequest("Remove the class's sections first");
    }
    await prisma.class.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

const createSectionSchema = z.object({
  name: z.string().min(1),
  classTeacherId: z.string().optional(),
});

classesRouter.post(
  "/:classId/sections",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { classId } = req.params;
    const data = createSectionSchema.parse(req.body);

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw ApiError.notFound("Class not found");

    const existing = await prisma.section.findUnique({
      where: { classId_name: { classId, name: data.name } },
    });
    if (existing) throw ApiError.conflict("That section already exists in this class");

    const created = await prisma.section.create({
      data: { name: data.name, classId, classTeacherId: data.classTeacherId },
    });
    res.status(201).json(created);
  })
);

classesRouter.delete(
  "/sections/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const studentCount = await prisma.student.count({
      where: { sectionId: req.params.id },
    });
    if (studentCount > 0) {
      throw ApiError.badRequest("Reassign the section's students first");
    }
    await prisma.section.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
