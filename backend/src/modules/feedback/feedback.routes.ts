import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const feedbackRouter = Router();

feedbackRouter.use(authenticate);

const STAFF = ["SUPER_ADMIN", "ADMIN", "DEAN", "ACCOUNTANT", "TEACHER"] as const;
const CATEGORIES = ["Academics", "Behaviour", "Sports", "Discipline", "Other"] as const;

const authorInclude = {
  author: {
    select: { email: true, role: true, teacher: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.StudentFeedbackInclude;

function authorName(a: {
  email: string;
  teacher: { firstName: string; lastName: string } | null;
} | null): string {
  if (!a) return "—";
  return a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : a.email;
}

// ── Staff: post feedback / commendation about a student ──────────────────────
const createSchema = z.object({
  studentId: z.string(),
  type: z.enum(["FEEDBACK", "COMMENDATION"]).default("FEEDBACK"),
  category: z.enum(CATEGORIES),
  message: z.string().min(1),
});

feedbackRouter.post(
  "/",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      select: { userId: true, parentId: true, firstName: true, lastName: true },
    });
    if (!student) throw ApiError.notFound("Student not found");

    const entry = await prisma.studentFeedback.create({
      data: {
        studentId: data.studentId,
        type: data.type,
        category: data.category,
        message: data.message,
        authorId: req.user!.sub,
      },
      include: authorInclude,
    });

    // Notify: feedback → the student; commendation → the parent.
    const name = `${student.firstName} ${student.lastName}`;
    if (data.type === "FEEDBACK" && student.userId) {
      await prisma.notification.create({
        data: { userId: student.userId, message: `New feedback from your teacher (${data.category}).`, link: "/feedback" },
      });
    }
    if (data.type === "COMMENDATION" && student.parentId) {
      await prisma.notification.create({
        data: { userId: student.parentId, message: `👏 Commendation for ${name} — ${data.category}.`, link: "/feedback" },
      });
    }

    res.status(201).json({
      id: entry.id,
      type: entry.type,
      category: entry.category,
      message: entry.message,
      author: authorName(entry.author),
      createdAt: entry.createdAt,
    });
  })
);

// ── Staff: a student's feedback history ──────────────────────────────────────
feedbackRouter.get(
  "/student/:studentId",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const items = await prisma.studentFeedback.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { createdAt: "desc" },
      include: authorInclude,
    });
    res.json({
      items: items.map((f) => ({
        id: f.id,
        type: f.type,
        category: f.category,
        message: f.message,
        author: authorName(f.author),
        createdAt: f.createdAt,
      })),
    });
  })
);

// ── Student / parent: feedback about me / my children ────────────────────────
feedbackRouter.get(
  "/mine",
  requireRole("STUDENT", "PARENT"),
  asyncHandler(async (req, res) => {
    const { sub, role } = req.user!;
    let studentIds: string[] = [];
    const nameById = new Map<string, string>();
    if (role === "STUDENT") {
      const s = await prisma.student.findUnique({
        where: { userId: sub },
        select: { id: true, firstName: true, lastName: true },
      });
      if (s) {
        studentIds = [s.id];
        nameById.set(s.id, `${s.firstName} ${s.lastName}`);
      }
    } else {
      const kids = await prisma.student.findMany({
        where: { parentId: sub },
        select: { id: true, firstName: true, lastName: true },
      });
      studentIds = kids.map((k) => k.id);
      kids.forEach((k) => nameById.set(k.id, `${k.firstName} ${k.lastName}`));
    }
    if (!studentIds.length) return res.json({ items: [] });

    const items = await prisma.studentFeedback.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { createdAt: "desc" },
      include: authorInclude,
    });
    res.json({
      items: items.map((f) => ({
        id: f.id,
        student: nameById.get(f.studentId) ?? "",
        type: f.type,
        category: f.category,
        message: f.message,
        author: authorName(f.author),
        createdAt: f.createdAt,
      })),
    });
  })
);
