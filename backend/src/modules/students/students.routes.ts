import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
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
    const student = await prisma.student.create({ data });
    res.status(201).json(student);
  })
);
