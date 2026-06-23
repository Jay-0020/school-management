import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { audit } from "../../lib/audit";
import { uploadPhoto, streamPhoto, deletePhotoFile } from "../../lib/photos";

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
    const search = String(req.query.search ?? "").trim();
    const status = req.query.status as string | undefined;

    const where: NonNullable<Parameters<typeof prisma.student.findMany>[0]>["where"] = {};
    if (sectionId) where.sectionId = sectionId;
    if (status && ["ACTIVE", "INACTIVE", "ALUMNI", "TRANSFERRED"].includes(status)) {
      where.status = status as "ACTIVE" | "INACTIVE" | "ALUMNI" | "TRANSFERRED";
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { admissionNo: { contains: search, mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { section: { include: { class: true } }, parent: { select: { id: true, email: true } } },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

// Parent accounts available to link in the student editor.
// (Defined before "/:id" so it isn't captured as an id.)
studentsRouter.get(
  "/parents",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (_req, res) => {
    const parents = await prisma.user.findMany({
      where: { role: "PARENT" },
      select: {
        id: true,
        email: true,
        children: { select: { firstName: true, lastName: true } },
      },
      orderBy: { email: "asc" },
    });
    res.json({
      items: parents.map((p) => ({
        id: p.id,
        email: p.email,
        children: p.children.map((c) => `${c.firstName} ${c.lastName}`),
      })),
    });
  })
);

const createSchema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date().nullish(),
  gender: z.string().nullish(),
  sectionId: z.string().nullish(),
  guardianName: z.string().nullish(),
  guardianPhone: z.string().nullish(),
  address: z.string().nullish(),
  admissionDate: z.coerce.date().nullish(),
  parentId: z.string().nullish(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALUMNI", "TRANSFERRED"]).optional(),
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
    // Default the admission date to today so onboarding counts are accurate.
    const student = await prisma.student.create({
      data: { ...data, admissionDate: data.admissionDate ?? new Date() },
    });
    audit(req, "student.create", `Added student ${student.firstName} ${student.lastName} (${student.admissionNo})`, { type: "Student", id: student.id });
    res.status(201).json(student);
  })
);

studentsRouter.get(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { section: { include: { class: true } }, parent: { select: { id: true, email: true } } },
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
  admissionDate: z.coerce.date().nullish(),
  parentId: z.string().nullish(),
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
    audit(req, "student.update", `Updated student ${student.firstName} ${student.lastName}`, { type: "Student", id: student.id });
    res.json(student);
  })
);

// ── Mark a student as left (retention) ───────────────────────────────────────
const leaveSchema = z.object({
  // Transferred to another school / Graduated (alumni) / Withdrawn (inactive).
  status: z.enum(["TRANSFERRED", "ALUMNI", "INACTIVE"]),
  leftAt: z.coerce.date().nullish(),
});

studentsRouter.post(
  "/:id/leave",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { status, leftAt } = leaveSchema.parse(req.body);
    const exists = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("Student not found");
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { status, leftAt: leftAt ?? new Date() },
    });
    audit(req, "student.leave", `Marked ${student.firstName} ${student.lastName} as left (${status})`, { type: "Student", id: student.id });
    res.json(student);
  })
);

studentsRouter.post(
  "/:id/reactivate",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const exists = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("Student not found");
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE", leftAt: null },
    });
    audit(req, "student.reactivate", `Reactivated ${student.firstName} ${student.lastName}`, { type: "Student", id: student.id });
    res.json(student);
  })
);

// ── Profile photo (per-tenant storage, served tenant-scoped) ────────────────
// GET is authenticated-only so <img> tags (which send the cookie) can render it.
studentsRouter.get(
  "/:id/photo",
  asyncHandler(async (req, res) => {
    const s = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { photoFile: true },
    });
    streamPhoto(res, s?.photoFile);
  })
);

studentsRouter.post(
  "/:id/photo",
  requireRole("SUPER_ADMIN", "ADMIN"),
  uploadPhoto,
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("A photo is required");
    const existing = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { photoFile: true, firstName: true, lastName: true },
    });
    if (!existing) {
      deletePhotoFile(req.file.filename);
      throw ApiError.notFound("Student not found");
    }
    await prisma.student.update({
      where: { id: req.params.id },
      data: { photoFile: req.file.filename },
    });
    deletePhotoFile(existing.photoFile);
    audit(req, "student.photo", `Updated photo for ${existing.firstName} ${existing.lastName}`, { type: "Student", id: req.params.id });
    res.status(201).json({ ok: true });
  })
);

studentsRouter.delete(
  "/:id/photo",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const s = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { photoFile: true },
    });
    if (!s) throw ApiError.notFound("Student not found");
    if (s.photoFile) {
      deletePhotoFile(s.photoFile);
      await prisma.student.update({ where: { id: req.params.id }, data: { photoFile: null } });
    }
    res.json({ ok: true });
  })
);
