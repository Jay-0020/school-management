import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { audit } from "../../lib/audit";

export const complaintsRouter = Router();

complaintsRouter.use(authenticate);

const FILE = ["STUDENT", "TEACHER", "PARENT"] as const;
const VIEW = ["DEAN", "SUPER_ADMIN"] as const;
const ANY = [...FILE, ...VIEW] as const;
const CATEGORIES = ["Behaviour", "Teaching quality", "Misconduct", "Other"] as const;

const roleLabel: Record<string, string> = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  PARENT: "Parent",
};

/** Staff that can be complained about (for the picker). */
complaintsRouter.get(
  "/staff",
  requireRole(...ANY),
  asyncHandler(async (_req, res) => {
    const staff = await prisma.teacher.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, staffType: true },
      orderBy: { firstName: "asc" },
    });
    res.json({
      items: staff.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        employeeNo: t.employeeNo,
        staffType: t.staffType,
      })),
    });
  })
);

// ── File a complaint ─────────────────────────────────────────────────────────
const createSchema = z.object({
  aboutStaffId: z.string(),
  category: z.enum(CATEGORIES),
  message: z.string().min(1),
  anonymous: z.boolean().default(false),
});

complaintsRouter.post(
  "/",
  requireRole(...FILE),
  asyncHandler(async (req, res) => {
    const { sub, role } = req.user!;
    const data = createSchema.parse(req.body);
    const staff = await prisma.teacher.findUnique({ where: { id: data.aboutStaffId } });
    if (!staff) throw ApiError.notFound("Staff member not found");

    // Identity is stored ONLY for non-anonymous complaints.
    let filedById: string | null = null;
    let filedByLabel: string | null = null;
    if (!data.anonymous) {
      const u = await prisma.user.findUnique({
        where: { id: sub },
        select: {
          email: true,
          teacher: { select: { firstName: true, lastName: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      });
      const nm = u?.teacher
        ? `${u.teacher.firstName} ${u.teacher.lastName}`
        : u?.student
        ? `${u.student.firstName} ${u.student.lastName}`
        : u?.email ?? "Unknown";
      filedById = sub;
      filedByLabel = `${nm} (${roleLabel[role] ?? role})`;
    }

    await prisma.complaint.create({
      data: {
        aboutStaffId: data.aboutStaffId,
        category: data.category,
        message: data.message,
        anonymous: data.anonymous,
        filedById,
        filedByLabel,
      },
    });

    // Only the Dean is notified.
    const deans = await prisma.user.findMany({
      where: { role: "DEAN", isActive: true },
      select: { id: true },
    });
    if (deans.length) {
      await prisma.notification.createMany({
        data: deans.map((d) => ({
          userId: d.id,
          message: `New complaint filed (${data.category}).`,
          link: "/complaints",
        })),
      });
    }

    res.status(201).json({ ok: true });
  })
);

// ── Dean / Super-Admin: view + resolve ───────────────────────────────────────
complaintsRouter.get(
  "/",
  requireRole(...VIEW),
  asyncHandler(async (_req, res) => {
    const items = await prisma.complaint.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { aboutStaff: { select: { firstName: true, lastName: true, employeeNo: true } } },
    });
    res.json({
      items: items.map((c) => ({
        id: c.id,
        aboutStaff: `${c.aboutStaff.firstName} ${c.aboutStaff.lastName}`,
        employeeNo: c.aboutStaff.employeeNo,
        filedBy: c.anonymous ? "Anonymous" : c.filedByLabel ?? "—",
        category: c.category,
        message: c.message,
        status: c.status,
        resolutionNote: c.resolutionNote,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
      })),
    });
  })
);

const resolveSchema = z.object({ note: z.string().nullish() });

complaintsRouter.post(
  "/:id/resolve",
  requireRole(...VIEW),
  asyncHandler(async (req, res) => {
    const { note } = resolveSchema.parse(req.body);
    const exists = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound("Complaint not found");
    const updated = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status: "RESOLVED", resolutionNote: note ?? null, resolvedById: req.user!.sub, resolvedAt: new Date() },
    });
    audit(req, "complaint.resolve", `Resolved a complaint (${exists.category})`, { type: "Complaint", id: exists.id });
    res.json({ ok: true, status: updated.status });
  })
);
