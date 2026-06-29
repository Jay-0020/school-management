import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import type { AttendanceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);

const STAFF = ["SUPER_ADMIN", "ADMIN", "TEACHER"] as const;

/** Sections a teacher may touch: those they're class teacher of OR assigned to. */
async function teacherSectionIds(userId: string): Promise<Set<string>> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: {
      classTeacherOf: { select: { id: true } },
      teachingAssignments: { select: { sectionId: true } },
    },
  });
  const ids = new Set<string>();
  teacher?.classTeacherOf.forEach((s) => ids.add(s.id));
  teacher?.teachingAssignments.forEach((a) => ids.add(a.sectionId));
  return ids;
}

/** A TEACHER may only read/write attendance for their own sections; admins any. */
async function assertSectionAccess(req: Request, sectionId: string) {
  if (req.user!.role !== "TEACHER") return;
  const ids = await teacherSectionIds(req.user!.sub);
  if (!ids.has(sectionId)) throw ApiError.forbidden("You can only manage attendance for your own sections");
}

/** Parse a "YYYY-MM-DD" string into a UTC-midnight Date. */
function parseDay(value: string): Date {
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").parse(value);
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Roster for a section on a given day: every active student plus their
 * attendance status for that date (null if not yet marked).
 */
attendanceRouter.get(
  "/",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const sectionId = z.string().min(1).parse(req.query.sectionId);
    await assertSectionAccess(req, sectionId);
    const date = parseDay(String(req.query.date));

    const [students, records] = await Promise.all([
      prisma.student.findMany({
        where: { sectionId, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, admissionNo: true, firstName: true, lastName: true },
      }),
      prisma.attendanceRecord.findMany({ where: { sectionId, date } }),
    ]);

    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    const roster = students.map((s) => ({
      studentId: s.id,
      admissionNo: s.admissionNo,
      firstName: s.firstName,
      lastName: s.lastName,
      status: byStudent.get(s.id)?.status ?? null,
      note: byStudent.get(s.id)?.note ?? null,
    }));

    res.json({ sectionId, date: date.toISOString().slice(0, 10), roster });
  })
);

const bulkSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        note: z.string().nullish(),
      })
    )
    .min(1),
});

/** Record (upsert) attendance for a whole section on a day. */
attendanceRouter.post(
  "/",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const { sectionId, date: dateStr, entries } = bulkSchema.parse(req.body);
    await assertSectionAccess(req, sectionId);
    const date = parseDay(dateStr);
    const markedById = req.user!.sub;

    // Every entry must be a student of THIS section — otherwise a posted
    // studentId could move another section's student into this section's record.
    const inSection = await prisma.student.findMany({
      where: { sectionId },
      select: { id: true },
    });
    const validIds = new Set(inSection.map((s) => s.id));
    if (entries.some((e) => !validIds.has(e.studentId))) {
      throw ApiError.badRequest("One or more students are not in this section");
    }

    await prisma.$transaction(
      entries.map((e) =>
        prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: e.studentId, date } },
          create: {
            studentId: e.studentId,
            sectionId,
            date,
            status: e.status,
            note: e.note ?? null,
            markedById,
          },
          // NB: sectionId is NOT updated — a record's section is fixed at create.
          update: { status: e.status, note: e.note ?? null, markedById },
        })
      )
    );

    res.json({ saved: entries.length });
  })
);

/**
 * Per-student attendance summary for a section over a date range:
 * counts by status, total marked days, and present %.
 */
attendanceRouter.get(
  "/summary",
  requireRole(...STAFF, "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const sectionId = z.string().min(1).parse(req.query.sectionId);
    await assertSectionAccess(req, sectionId);
    const from = parseDay(String(req.query.from));
    const to = parseDay(String(req.query.to));
    if (to < from) throw ApiError.badRequest("'to' must be on or after 'from'");

    const [students, records] = await Promise.all([
      prisma.student.findMany({
        where: { sectionId, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, admissionNo: true, firstName: true, lastName: true },
      }),
      prisma.attendanceRecord.findMany({
        where: { sectionId, date: { gte: from, lte: to } },
      }),
    ]);

    const blank = () => ({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });
    const counts = new Map<string, Record<AttendanceStatus, number>>();
    for (const s of students) counts.set(s.id, blank());
    for (const r of records) {
      const c = counts.get(r.studentId);
      if (c) c[r.status] += 1;
    }

    const summary = students.map((s) => {
      const c = counts.get(s.id)!;
      const marked = c.PRESENT + c.ABSENT + c.LATE + c.EXCUSED;
      // Late still counts as attended for the percentage.
      const attended = c.PRESENT + c.LATE;
      const percent = marked === 0 ? null : Math.round((attended / marked) * 100);
      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        firstName: s.firstName,
        lastName: s.lastName,
        ...c,
        marked,
        percent,
      };
    });

    res.json({
      sectionId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      summary,
    });
  })
);
