import { Router } from "express";
import type { AttendanceRecord } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const parentRouter = Router();

parentRouter.use(authenticate, requireRole("PARENT", "ADMIN", "SUPER_ADMIN"));

/** Academic-year (Apr–Mar) label for a date. */
function academicYear(date: Date): string {
  const y = date.getUTCFullYear();
  return date.getUTCMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function attendanceByYear(records: AttendanceRecord[]) {
  const by = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
  for (const r of records) {
    const yr = academicYear(r.date);
    const b = by.get(yr) ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    if (r.status === "PRESENT") b.present++;
    else if (r.status === "ABSENT") b.absent++;
    else if (r.status === "LATE") b.late++;
    else if (r.status === "EXCUSED") b.excused++;
    b.total++;
    by.set(yr, b);
  }
  return [...by.entries()]
    .map(([year, b]) => ({ year, ...b, percent: b.total ? Math.round(((b.present + b.late) / b.total) * 100) : null }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));
}

/** Resolve a child the current user is allowed to see; PARENT must own it. */
async function getChild(userId: string, role: string, childId: string) {
  const where = role === "PARENT" ? { id: childId, parentId: userId } : { id: childId };
  const student = await prisma.student.findFirst({
    where,
    include: { section: { include: { class: true } } },
  });
  if (!student) throw ApiError.forbidden();
  return student;
}

// ── Children of the logged-in parent ────────────────────────────────────────
parentRouter.get(
  "/children",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const where = role === "PARENT" ? { parentId: sub } : {};
    const children = await prisma.student.findMany({
      where,
      orderBy: { firstName: "asc" },
      include: { section: { include: { class: true } } },
    });
    res.json({
      items: children.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        admissionNo: c.admissionNo,
        className: c.section ? `${c.section.class.name} · ${c.section.name}` : null,
      })),
    });
  })
);

// ── Consolidated read-only overview for one child ───────────────────────────
parentRouter.get(
  "/children/:childId/overview",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const child = await getChild(sub, role, req.params.childId);

    const [attendance, invoiceAgg, invoices, homework, exams] = await Promise.all([
      prisma.attendanceRecord.findMany({ where: { studentId: child.id } }),
      prisma.invoice.aggregate({
        where: { studentId: child.id, status: { in: ["PENDING", "PARTIAL"] } },
        _sum: { total: true, amountPaid: true },
      }),
      prisma.invoice.findMany({
        where: { studentId: child.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, total: true, amountPaid: true, status: true, dueDate: true },
      }),
      child.sectionId
        ? prisma.homework.findMany({
            where: { sectionId: child.sectionId },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { subject: { select: { name: true } } },
          })
        : Promise.resolve([]),
      child.section
        ? prisma.exam.findMany({
            where: { classId: child.section.classId, status: "PUBLISHED" },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, term: true },
          })
        : Promise.resolve([]),
    ]);

    const feesDue = (invoiceAgg._sum.total ?? 0) - (invoiceAgg._sum.amountPaid ?? 0);
    res.json({
      student: {
        id: child.id,
        name: `${child.firstName} ${child.lastName}`,
        admissionNo: child.admissionNo,
        className: child.section ? `${child.section.class.name} · ${child.section.name}` : null,
      },
      attendance: attendanceByYear(attendance),
      fees: {
        due: feesDue,
        invoices: invoices.map((i) => ({ ...i, balance: i.total - i.amountPaid })),
      },
      homework: homework.map((h) => ({
        id: h.id,
        title: h.title,
        subject: h.subject?.name ?? null,
        dueDate: h.dueDate,
      })),
      exams,
    });
  })
);
