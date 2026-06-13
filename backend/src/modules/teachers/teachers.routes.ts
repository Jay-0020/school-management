import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const teachersRouter = Router();

teachersRouter.use(authenticate);

teachersRouter.get(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 25);

    const [items, total] = await Promise.all([
      prisma.teacher.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.teacher.count(),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

const createSchema = z.object({
  employeeNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  staffType: z.enum(["TEACHING", "NON_TEACHING"]).default("TEACHING"),
  qualifications: z.string().optional(),
  joiningDate: z.coerce.date().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

teachersRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const teacher = await prisma.teacher.create({ data });
    res.status(201).json(teacher);
  })
);
