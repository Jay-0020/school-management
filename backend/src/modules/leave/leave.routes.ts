import { Router } from "express";
import { z } from "zod";
import type { LeaveCategory, Prisma, Role, User } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { notify, notifyMany } from "../../lib/notify";
import { authenticate } from "../../middleware/auth";

export const leaveRouter = Router();

leaveRouter.use(authenticate);

const STAFF_ROLES: Role[] = ["TEACHER", "ACCOUNTANT"];

const dayCount = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

/** Current Indian academic year (Apr 1 – Mar 31) as a UTC date range. */
function academicYearRange(now = new Date()) {
  const y = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= 3 ? y : y - 1;
  return {
    start: new Date(Date.UTC(startYear, 3, 1)),
    end: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59)),
  };
}

const QUOTA_CATEGORIES = ["CASUAL", "SICK"] as const;

/** This user's quota for a leave category. */
function categoryQuota(user: User, category: LeaveCategory): number {
  return category === "SICK" ? user.sickQuota : user.casualQuota;
}

/** Approved leave days used this academic year, by category. */
async function usedDays(userId: string, category: LeaveCategory): Promise<number> {
  const { start, end } = academicYearRange();
  const approved = await prisma.leaveRequest.findMany({
    where: {
      applicantId: userId,
      category,
      status: "APPROVED",
      fromDate: { gte: start, lte: end },
    },
    select: { fromDate: true, toDate: true },
  });
  return approved.reduce((sum, r) => sum + dayCount(r.fromDate, r.toDate), 0);
}

/** Users who should review a given applicant's leave. */
async function resolveApprovers(applicantId: string): Promise<string[]> {
  const applicant = await prisma.user.findUnique({
    where: { id: applicantId },
    include: { student: { include: { section: { include: { classTeacher: true } } } } },
  });
  if (!applicant) return [];
  if (applicant.role === "STUDENT" || applicant.role === "PARENT") {
    const ctUser = applicant.student?.section?.classTeacher?.userId;
    if (ctUser) return [ctUser];
  }
  // staff (or student with no class-teacher login) → deans, else admins
  const deans = await prisma.user.findMany({
    where: { role: "DEAN", isActive: true },
    select: { id: true },
  });
  if (deans.length) return deans.map((d) => d.id);
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

function applicantName(a: {
  email: string;
  student?: { firstName: string; lastName: string } | null;
  teacher?: { firstName: string; lastName: string } | null;
}): string {
  if (a.student) return `${a.student.firstName} ${a.student.lastName}`;
  if (a.teacher) return `${a.teacher.firstName} ${a.teacher.lastName}`;
  return a.email;
}

const include = {
  applicant: {
    select: {
      id: true,
      email: true,
      role: true,
      student: { select: { id: true, firstName: true, lastName: true, sectionId: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  approver: { select: { id: true, email: true } },
} satisfies Prisma.LeaveRequestInclude;

function parseDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Section ids a teacher is class teacher of (their approval scope). */
async function classTeacherSectionIds(userId: string): Promise<string[]> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { classTeacherOf: { select: { id: true } } },
  });
  return teacher?.classTeacherOf.map((s) => s.id) ?? [];
}

// ── Submit ──────────────────────────────────────────────────────────────────
const createSchema = z
  .object({
    kind: z.enum(["ADVANCE", "JUSTIFICATION"]),
    category: z.enum(["CASUAL", "SICK"]).default("CASUAL"),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().min(1),
  })
  .refine((d) => d.toDate >= d.fromDate, {
    message: "End date must be on or after start date",
    path: ["toDate"],
  });

leaveRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const from = parseDay(data.fromDate);
    const to = parseDay(data.toDate);
    const requested = dayCount(from, to);

    // Advance permission is checked against the category quota; a justification
    // for a past absence is recorded regardless.
    if (data.kind === "ADVANCE") {
      const me = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      const quota = me ? categoryQuota(me, data.category) : 0;
      const used = await usedDays(req.user!.sub, data.category);
      const remaining = quota - used;
      if (requested > remaining) {
        throw ApiError.badRequest(
          `Exceeds your ${data.category.toLowerCase()} leave balance — ${remaining} day(s) left this year`
        );
      }
    }

    const request = await prisma.leaveRequest.create({
      data: {
        applicantId: req.user!.sub,
        kind: data.kind,
        category: data.category,
        fromDate: from,
        toDate: to,
        reason: data.reason,
      },
      include,
    });

    // Notify the approver(s) that a request is waiting.
    const approvers = await resolveApprovers(req.user!.sub);
    if (approvers.length) {
      await notifyMany(
        approvers,
        `New leave request from ${applicantName(request.applicant)}`,
        "/leave"
      );
    }

    res.status(201).json(request);
  })
);

// Current user's leave balance per category for the academic year.
leaveRouter.get(
  "/balance",
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    const balances = await Promise.all(
      QUOTA_CATEGORIES.map(async (category) => {
        const quota = me ? (categoryQuota(me, category) ?? 0) : 0;
        const used = await usedDays(req.user!.sub, category);
        return { category, quota, used, remaining: Math.max(0, quota - used) };
      })
    );
    res.json({ balances });
  })
);

// ── List: mine | inbox ───────────────────────────────────────────────────────
leaveRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const scope = req.query.scope === "inbox" ? "inbox" : "mine";

    let where: Prisma.LeaveRequestWhereInput;
    if (scope === "mine") {
      where = { applicantId: sub };
    } else if (role === "SUPER_ADMIN" || role === "ADMIN") {
      where = {}; // full oversight
    } else if (role === "DEAN") {
      where = { applicant: { role: { in: STAFF_ROLES } } };
    } else if (role === "TEACHER") {
      const sectionIds = await classTeacherSectionIds(sub);
      where = { applicant: { student: { sectionId: { in: sectionIds } } } };
    } else {
      where = { id: "__none__" };
    }

    const items = await prisma.leaveRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include,
    });
    res.json({ items });
  })
);

// ── Decide ────────────────────────────────────────────────────────────────
type RequestWithApplicant = Prisma.LeaveRequestGetPayload<{ include: typeof include }>;

async function canApprove(
  approverRole: Role,
  approverUserId: string,
  request: RequestWithApplicant
): Promise<boolean> {
  if (approverRole === "SUPER_ADMIN" || approverRole === "ADMIN") return true;
  if (request.applicantId === approverUserId) return false; // can't self-approve
  if (approverRole === "DEAN") return STAFF_ROLES.includes(request.applicant.role);
  if (approverRole === "TEACHER") {
    const sectionId = request.applicant.student?.sectionId;
    if (!sectionId) return false;
    const sectionIds = await classTeacherSectionIds(approverUserId);
    return sectionIds.includes(sectionId);
  }
  return false;
}

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().nullish(),
});

leaveRouter.post(
  "/:id/decision",
  asyncHandler(async (req, res) => {
    const { decision, note } = decisionSchema.parse(req.body);
    const request = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include,
    });
    if (!request) throw ApiError.notFound("Leave request not found");
    if (request.status !== "PENDING") {
      throw ApiError.badRequest("This request has already been decided");
    }
    const { role, sub } = req.user!;
    if (!(await canApprove(role, sub, request))) throw ApiError.forbidden();

    const updated = await prisma.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: decision,
        approverId: sub,
        decisionNote: note ?? null,
        decidedAt: new Date(),
      },
      include,
    });

    // Notify the applicant of the outcome.
    const range =
      request.fromDate.toISOString().slice(0, 10) +
      (request.toDate.getTime() !== request.fromDate.getTime()
        ? `–${request.toDate.toISOString().slice(0, 10)}`
        : "");
    await notify(
      request.applicantId,
      `Your leave (${range}) was ${decision === "APPROVED" ? "approved" : "rejected"}`,
      "/leave"
    );

    // Approved student leave → mark those dates EXCUSED in attendance.
    const student = request.applicant.student;
    if (decision === "APPROVED" && student?.sectionId) {
      const days: Date[] = [];
      for (
        let d = new Date(request.fromDate);
        d <= request.toDate;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        days.push(new Date(d));
      }
      await prisma.$transaction(
        days.map((date) =>
          prisma.attendanceRecord.upsert({
            where: { studentId_date: { studentId: student.id, date } },
            create: {
              studentId: student.id,
              sectionId: student.sectionId!,
              date,
              status: "EXCUSED",
              note: "Approved leave",
              markedById: sub,
            },
            update: { status: "EXCUSED", note: "Approved leave" },
          })
        )
      );
    }

    res.json(updated);
  })
);

// ── Cancel own pending request ───────────────────────────────────────────────
leaveRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const request = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!request) throw ApiError.notFound("Leave request not found");
    if (request.applicantId !== req.user!.sub) throw ApiError.forbidden();
    if (request.status !== "PENDING") {
      throw ApiError.badRequest("Only pending requests can be cancelled");
    }
    const updated = await prisma.leaveRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
      include,
    });
    res.json(updated);
  })
);
