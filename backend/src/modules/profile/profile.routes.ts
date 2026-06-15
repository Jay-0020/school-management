import { Router } from "express";
import type { AttendanceRecord } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const profileRouter = Router();

profileRouter.use(authenticate);

/** Indian academic year label for a date (Apr–Mar). */
function academicYear(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0=Jan
  return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

interface YearBucket {
  year: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percent: number | null;
}

/** Aggregate a student's attendance into per-academic-year buckets + monthly (current year). */
function summarise(records: AttendanceRecord[]) {
  const byYear = new Map<string, YearBucket>();
  for (const r of records) {
    const yr = academicYear(r.date);
    let b = byYear.get(yr);
    if (!b) {
      b = { year: yr, present: 0, absent: 0, late: 0, excused: 0, total: 0, percent: null };
      byYear.set(yr, b);
    }
    if (r.status === "PRESENT") b.present++;
    else if (r.status === "ABSENT") b.absent++;
    else if (r.status === "LATE") b.late++;
    else if (r.status === "EXCUSED") b.excused++;
    b.total++;
  }
  const years = [...byYear.values()]
    .map((b) => ({
      ...b,
      percent: b.total ? Math.round(((b.present + b.late) / b.total) * 100) : null,
    }))
    .sort((a, b) => (a.year < b.year ? 1 : -1));

  // Monthly breakdown for the most recent academic year.
  const latest = years[0]?.year;
  const monthly: { month: string; present: number; total: number; percent: number | null }[] = [];
  if (latest) {
    const byMonth = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      if (academicYear(r.date) !== latest) continue;
      const key = r.date.toISOString().slice(0, 7); // YYYY-MM
      const m = byMonth.get(key) ?? { present: 0, total: 0 };
      if (r.status === "PRESENT" || r.status === "LATE") m.present++;
      m.total++;
      byMonth.set(key, m);
    }
    for (const [month, m] of [...byMonth.entries()].sort()) {
      monthly.push({
        month,
        present: m.present,
        total: m.total,
        percent: m.total ? Math.round((m.present / m.total) * 100) : null,
      });
    }
  }
  return { years, monthly };
}

async function studentOverview(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { section: { include: { class: true } } },
  });
  if (!student) throw ApiError.notFound("Student not found");
  const records = await prisma.attendanceRecord.findMany({ where: { studentId } });
  return {
    type: "student" as const,
    id: student.id,
    name: `${student.firstName} ${student.lastName}`,
    admissionNo: student.admissionNo,
    className: student.section ? `${student.section.class.name} · ${student.section.name}` : null,
    status: student.status,
    attendance: summarise(records),
  };
}

async function staffOverview(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const leaves = await prisma.leaveRequest.findMany({
    where: { applicantId: userId },
    orderBy: { fromDate: "desc" },
  });
  const approvedDays = leaves
    .filter((l) => l.status === "APPROVED")
    .reduce((sum, l) => {
      const days =
        Math.round((l.toDate.getTime() - l.fromDate.getTime()) / 86400000) + 1;
      return sum + days;
    }, 0);
  return {
    type: "staff" as const,
    id: userId,
    name: teacher ? `${teacher.firstName} ${teacher.lastName}` : (user?.email ?? "Staff"),
    role: user?.role,
    employeeNo: teacher?.employeeNo ?? null,
    leave: {
      approvedDays,
      pending: leaves.filter((l) => l.status === "PENDING").length,
      recent: leaves.slice(0, 5).map((l) => ({
        id: l.id,
        kind: l.kind,
        from: l.fromDate.toISOString().slice(0, 10),
        to: l.toDate.toISOString().slice(0, 10),
        status: l.status,
        reason: l.reason,
      })),
    },
  };
}

// ── My own profile ────────────────────────────────────────────────────────
profileRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    if (role === "STUDENT" || role === "PARENT") {
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      if (!student) return res.json({ type: "none", message: "No student record linked" });
      return res.json(await studentOverview(student.id));
    }
    res.json(await staffOverview(sub));
  })
);

// ── A specific student (self / teacher / dean / admin) ──────────────────────
profileRouter.get(
  "/student/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER", "STUDENT", "PARENT"),
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    if (role === "STUDENT" || role === "PARENT") {
      const me = await prisma.student.findUnique({ where: { userId: sub } });
      if (me?.id !== req.params.id) throw ApiError.forbidden();
    }
    res.json(await studentOverview(req.params.id));
  })
);

// ── Directory: teacher → students; dean/admin → staff + students ────────────
profileRouter.get(
  "/people",
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const { role } = req.user!;

    const students = await prisma.student.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }],
      include: {
        section: { include: { class: true } },
        _count: { select: { attendance: true } },
      },
    });
    // Attendance % per student in one grouped query.
    const att = await prisma.attendanceRecord.groupBy({
      by: ["studentId", "status"],
      _count: true,
    });
    const tally = new Map<string, { present: number; total: number }>();
    for (const a of att) {
      const t = tally.get(a.studentId) ?? { present: 0, total: 0 };
      if (a.status === "PRESENT" || a.status === "LATE") t.present += a._count;
      t.total += a._count;
      tally.set(a.studentId, t);
    }
    const studentRows = students.map((s) => {
      const t = tally.get(s.id) ?? { present: 0, total: 0 };
      return {
        type: "student" as const,
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        admissionNo: s.admissionNo,
        className: s.section ? `${s.section.class.name} · ${s.section.name}` : "—",
        grade: s.section?.class.name ?? null,
        section: s.section?.name ?? null,
        attendancePercent: t.total ? Math.round((t.present / t.total) * 100) : null,
      };
    });

    let staffRows: unknown[] = [];
    if (role !== "TEACHER") {
      const staff = await prisma.teacher.findMany({
        where: { isActive: true },
        orderBy: [{ firstName: "asc" }],
      });
      staffRows = staff.map((t) => ({
        type: "staff" as const,
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        employeeNo: t.employeeNo,
        staffType: t.staffType,
      }));
    }

    res.json({ students: studentRows, staff: staffRows });
  })
);
