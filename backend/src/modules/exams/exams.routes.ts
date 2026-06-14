import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const examsRouter = Router();

examsRouter.use(authenticate);

const STAFF = ["SUPER_ADMIN", "ADMIN", "TEACHER"] as const;
const ADMINS = ["SUPER_ADMIN", "ADMIN"] as const;

/** CBSE-style grade from a percentage. */
function grade(percent: number): string {
  if (percent >= 91) return "A1";
  if (percent >= 81) return "A2";
  if (percent >= 71) return "B1";
  if (percent >= 61) return "B2";
  if (percent >= 51) return "C1";
  if (percent >= 41) return "C2";
  if (percent >= 33) return "D";
  return "E";
}

const examInclude = {
  class: { select: { id: true, name: true } },
  papers: {
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { subject: { name: "asc" } },
  },
} satisfies Prisma.ExamInclude;

// ── Exams CRUD ────────────────────────────────────────────────────────────
examsRouter.get(
  "/",
  requireRole(...STAFF, "ACCOUNTANT", "DEAN"),
  asyncHandler(async (req, res) => {
    const where: Prisma.ExamWhereInput = {};
    if (req.query.classId) where.classId = String(req.query.classId);
    const items = await prisma.exam.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: examInclude,
    });
    res.json({ items });
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  classId: z.string().min(1),
  term: z.string().nullish(),
  examDate: z.coerce.date().nullish(),
});

examsRouter.post(
  "/",
  requireRole(...ADMINS),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const cls = await prisma.class.findUnique({ where: { id: data.classId } });
    if (!cls) throw ApiError.notFound("Class not found");
    const exam = await prisma.exam.create({
      data: {
        name: data.name,
        classId: data.classId,
        term: data.term ?? null,
        examDate: data.examDate ?? null,
      },
      include: examInclude,
    });
    res.status(201).json(exam);
  })
);

examsRouter.get(
  "/:id",
  requireRole(...STAFF, "ACCOUNTANT", "DEAN"),
  asyncHandler(async (req, res) => {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: examInclude });
    if (!exam) throw ApiError.notFound("Exam not found");
    res.json(exam);
  })
);

examsRouter.patch(
  "/:id",
  requireRole(...ADMINS),
  asyncHandler(async (req, res) => {
    const data = z.object({ status: z.enum(["DRAFT", "PUBLISHED"]) }).parse(req.body);
    const exam = await prisma.exam.update({
      where: { id: req.params.id },
      data: { status: data.status },
      include: examInclude,
    });
    res.json(exam);
  })
);

examsRouter.delete(
  "/:id",
  requireRole(...ADMINS),
  asyncHandler(async (req, res) => {
    await prisma.exam.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

// ── Papers (subjects in an exam) ────────────────────────────────────────────
const paperSchema = z.object({
  subjectId: z.string().min(1),
  maxMarks: z.number().int().positive(),
  passMarks: z.number().int().nonnegative().optional(),
});

examsRouter.post(
  "/:id/papers",
  requireRole(...ADMINS),
  asyncHandler(async (req, res) => {
    const data = paperSchema.parse(req.body);
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) throw ApiError.notFound("Exam not found");
    const dupe = await prisma.examPaper.findUnique({
      where: { examId_subjectId: { examId: exam.id, subjectId: data.subjectId } },
    });
    if (dupe) throw ApiError.conflict("That subject is already in this exam");
    const paper = await prisma.examPaper.create({
      data: {
        examId: exam.id,
        subjectId: data.subjectId,
        maxMarks: data.maxMarks,
        passMarks: data.passMarks ?? 33,
      },
      include: { subject: { select: { id: true, name: true } } },
    });
    res.status(201).json(paper);
  })
);

examsRouter.delete(
  "/papers/:paperId",
  requireRole(...ADMINS),
  asyncHandler(async (req, res) => {
    await prisma.examPaper.delete({ where: { id: req.params.paperId } });
    res.status(204).end();
  })
);

// ── Marks entry ─────────────────────────────────────────────────────────────
// Roster for a paper within a section: each active student + their mark.
examsRouter.get(
  "/:id/marks",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const paperId = z.string().min(1).parse(req.query.paperId);
    const sectionId = z.string().min(1).parse(req.query.sectionId);
    const paper = await prisma.examPaper.findUnique({ where: { id: paperId } });
    if (!paper) throw ApiError.notFound("Paper not found");

    const [students, marks] = await Promise.all([
      prisma.student.findMany({
        where: { sectionId, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, admissionNo: true, firstName: true, lastName: true },
      }),
      prisma.mark.findMany({ where: { paperId } }),
    ]);
    const byStudent = new Map(marks.map((m) => [m.studentId, m.marksObtained]));
    res.json({
      maxMarks: paper.maxMarks,
      roster: students.map((s) => ({
        studentId: s.id,
        admissionNo: s.admissionNo,
        name: `${s.firstName} ${s.lastName}`,
        marksObtained: byStudent.get(s.id) ?? null,
      })),
    });
  })
);

const marksSchema = z.object({
  paperId: z.string().min(1),
  entries: z
    .array(z.object({ studentId: z.string().min(1), marksObtained: z.number().int().min(0) }))
    .min(1),
});

examsRouter.post(
  "/:id/marks",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const { paperId, entries } = marksSchema.parse(req.body);
    const paper = await prisma.examPaper.findUnique({ where: { id: paperId } });
    if (!paper) throw ApiError.notFound("Paper not found");
    if (paper.examId !== req.params.id) throw ApiError.badRequest("Paper is not in this exam");

    for (const e of entries) {
      if (e.marksObtained > paper.maxMarks) {
        throw ApiError.badRequest(`Marks can't exceed the max of ${paper.maxMarks}`);
      }
    }

    await prisma.$transaction(
      entries.map((e) =>
        prisma.mark.upsert({
          where: { paperId_studentId: { paperId, studentId: e.studentId } },
          create: {
            examId: paper.examId,
            paperId,
            studentId: e.studentId,
            marksObtained: e.marksObtained,
          },
          update: { marksObtained: e.marksObtained },
        })
      )
    );
    res.json({ saved: entries.length });
  })
);

// ── Report card ─────────────────────────────────────────────────────────────
async function buildReport(examId: string, studentId: string) {
  const [exam, student, marks] = await Promise.all([
    prisma.exam.findUnique({ where: { id: examId }, include: examInclude }),
    prisma.student.findUnique({
      where: { id: studentId },
      include: { section: { include: { class: true } } },
    }),
    prisma.mark.findMany({ where: { examId, studentId } }),
  ]);
  if (!exam) throw ApiError.notFound("Exam not found");
  if (!student) throw ApiError.notFound("Student not found");

  const markByPaper = new Map(marks.map((m) => [m.paperId, m.marksObtained]));
  const subjects = exam.papers.map((p) => {
    const obtained = markByPaper.get(p.id);
    const pct = obtained == null ? null : Math.round((obtained / p.maxMarks) * 100);
    return {
      subject: p.subject.name,
      maxMarks: p.maxMarks,
      passMarks: p.passMarks,
      marksObtained: obtained ?? null,
      percent: pct,
      grade: pct == null ? null : grade(pct),
      passed: obtained == null ? null : obtained >= p.passMarks,
    };
  });
  const graded = subjects.filter((s) => s.marksObtained != null);
  const totalMax = graded.reduce((a, s) => a + s.maxMarks, 0);
  const totalObtained = graded.reduce((a, s) => a + (s.marksObtained ?? 0), 0);
  const overallPct = totalMax ? Math.round((totalObtained / totalMax) * 100) : null;
  const result = subjects.some((s) => s.passed === false) ? "FAIL" : "PASS";

  return {
    exam: { id: exam.id, name: exam.name, term: exam.term, status: exam.status },
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      admissionNo: student.admissionNo,
      className: student.section
        ? `${student.section.class.name} · ${student.section.name}`
        : null,
    },
    subjects,
    totalObtained,
    totalMax,
    overallPercent: overallPct,
    overallGrade: overallPct == null ? null : grade(overallPct),
    result: graded.length === 0 ? null : result,
  };
}

examsRouter.get(
  "/:id/report/:studentId",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    if (role === "STUDENT" || role === "PARENT") {
      const me = await prisma.student.findUnique({ where: { userId: sub } });
      if (me?.id !== req.params.studentId) throw ApiError.forbidden();
      const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
      if (exam?.status !== "PUBLISHED") throw ApiError.forbidden();
    } else if (!["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"].includes(role)) {
      throw ApiError.forbidden();
    }
    res.json(await buildReport(req.params.id, req.params.studentId));
  })
);

// Published exams for the logged-in student (their report cards list).
examsRouter.get(
  "/mine/list",
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
    if (!student?.sectionId) return res.json({ studentId: null, items: [] });
    const section = await prisma.section.findUnique({ where: { id: student.sectionId } });
    const items = await prisma.exam.findMany({
      where: { classId: section?.classId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, term: true, examDate: true },
    });
    res.json({ studentId: student.id, items });
  })
);

// Section-wide results summary (managers): totals + rank.
examsRouter.get(
  "/:id/results",
  requireRole(...STAFF, "DEAN"),
  asyncHandler(async (req, res) => {
    const sectionId = z.string().min(1).parse(req.query.sectionId);
    const [exam, students] = await Promise.all([
      prisma.exam.findUnique({ where: { id: req.params.id }, include: examInclude }),
      prisma.student.findMany({
        where: { sectionId, status: "ACTIVE" },
        select: { id: true, admissionNo: true, firstName: true, lastName: true },
      }),
    ]);
    if (!exam) throw ApiError.notFound("Exam not found");
    const totalMax = exam.papers.reduce((a, p) => a + p.maxMarks, 0);
    const allMarks = await prisma.mark.findMany({
      where: { examId: exam.id, studentId: { in: students.map((s) => s.id) } },
    });
    const obtainedBy = new Map<string, number>();
    for (const m of allMarks) obtainedBy.set(m.studentId, (obtainedBy.get(m.studentId) ?? 0) + m.marksObtained);

    const rows = students
      .map((s) => {
        const obtained = obtainedBy.get(s.id) ?? 0;
        const pct = totalMax ? Math.round((obtained / totalMax) * 100) : null;
        return {
          studentId: s.id,
          admissionNo: s.admissionNo,
          name: `${s.firstName} ${s.lastName}`,
          totalObtained: obtained,
          totalMax,
          percent: pct,
          grade: pct == null ? null : grade(pct),
        };
      })
      .sort((a, b) => b.totalObtained - a.totalObtained)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    res.json({ exam: { id: exam.id, name: exam.name }, totalMax, rows });
  })
);
