import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const studentsRouter = Router();

studentsRouter.use(authenticate);

// List students (paginated). Staff-facing.
studentsRouter.get(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 25);
    const sectionId = req.query.sectionId as string | undefined;

    const where = sectionId ? { sectionId } : {};
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { section: { include: { class: true } } },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

const createSchema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.string().optional(),
  sectionId: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  address: z.string().optional(),
});

studentsRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const clash = await prisma.student.findUnique({
      where: { admissionNo: data.admissionNo },
    });
    if (clash) throw ApiError.conflict("Admission number already in use");
    const student = await prisma.student.create({ data });
    res.status(201).json(student);
  })
);

studentsRouter.get(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { section: { include: { class: true } } },
    });
    if (!student) throw ApiError.notFound("Student not found");
    res.json(student);
  })
);

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.coerce.date().nullish(),
  gender: z.string().nullish(),
  sectionId: z.string().nullish(),
  guardianName: z.string().nullish(),
  guardianPhone: z.string().nullish(),
  address: z.string().nullish(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI", "TRANSFERRED"]).optional(),
});

studentsRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const exists = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("Student not found");
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data,
    });
    res.json(student);
  })
);
