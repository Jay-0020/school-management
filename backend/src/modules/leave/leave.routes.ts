import { Router } from "express";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate } from "../../middleware/auth";

export const leaveRouter = Router();

leaveRouter.use(authenticate);

const STAFF_ROLES: Role[] = ["TEACHER", "ACCOUNTANT"];

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
    const request = await prisma.leaveRequest.create({
      data: {
        applicantId: req.user!.sub,
        kind: data.kind,
        fromDate: parseDay(data.fromDate),
        toDate: parseDay(data.toDate),
        reason: data.reason,
      },
      include,
    });
    res.status(201).json(request);
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
