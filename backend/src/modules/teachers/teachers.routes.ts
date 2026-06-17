import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const teachersRouter = Router();

teachersRouter.use(authenticate);

teachersRouter.get(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 25);

    const search = String(req.query.search ?? "").trim();
    const staffType = req.query.staffType;
    const status = req.query.status; // "active" | "inactive"

    const where: NonNullable<Parameters<typeof prisma.teacher.findMany>[0]>["where"] = {};
    if (staffType === "TEACHING" || staffType === "NON_TEACHING") {
      where.staffType = staffType;
    }
    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { employeeNo: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.teacher.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

const createSchema = z.object({
  employeeNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  staffType: z.enum(["TEACHING", "NON_TEACHING"]).default("TEACHING"),
  qualifications: z.string().nullish(),
  joiningDate: z.coerce.date().nullish(),
  phone: z.string().nullish(),
  email: z.string().email().nullish(),
});

teachersRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const clash = await prisma.teacher.findUnique({
      where: { employeeNo: data.employeeNo },
    });
    if (clash) throw ApiError.conflict("Employee number already in use");
    const teacher = await prisma.teacher.create({ data });
    res.status(201).json(teacher);
  })
);

teachersRouter.get(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: { classTeacherOf: { include: { class: true } } },
    });
    if (!teacher) throw ApiError.notFound("Teacher not found");
    res.json(teacher);
  })
);

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  staffType: z.enum(["TEACHING", "NON_TEACHING"]).optional(),
  isActive: z.boolean().optional(),
  qualifications: z.string().nullish(),
  joiningDate: z.coerce.date().nullish(),
  phone: z.string().nullish(),
  email: z.string().email().nullish(),
});

teachersRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const exists = await prisma.teacher.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("Teacher not found");
    const teacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data,
    });
    res.json(teacher);
  })
);
