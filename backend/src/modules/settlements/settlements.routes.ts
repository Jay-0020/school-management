import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { audit } from "../../lib/audit";

export const settlementsRouter = Router();

settlementsRouter.use(authenticate);

const MANAGE = ["SUPER_ADMIN", "ADMIN", "DEAN"] as const; // create + approve/reject
const VIEW = ["SUPER_ADMIN", "ADMIN", "DEAN", "ACCOUNTANT"] as const;
const PAY = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] as const;

const include = {
  teacher: {
    select: { id: true, firstName: true, lastName: true, employeeNo: true, staffType: true },
  },
} satisfies Prisma.SettlementInclude;

/** Unpaid (generated-but-not-paid) salary for a staff member. */
async function pendingSalaryFor(teacherId: string): Promise<number> {
  const agg = await prisma.payslip.aggregate({
    where: { teacherId, status: "GENERATED" },
    _sum: { net: true },
  });
  return agg._sum.net ?? 0;
}

// ── List ─────────────────────────────────────────────────────────────────────
settlementsRouter.get(
  "/",
  requireRole(...VIEW),
  asyncHandler(async (req, res) => {
    const where: Prisma.SettlementWhereInput = {};
    if (req.query.status) where.status = req.query.status as Prisma.SettlementWhereInput["status"];
    const items = await prisma.settlement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include,
    });
    res.json({ items });
  })
);

// ── Active staff + their pending salary (for the create picker) ──────────────
settlementsRouter.get(
  "/staff",
  requireRole(...MANAGE),
  asyncHandler(async (_req, res) => {
    const teachers = await prisma.teacher.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, staffType: true },
      orderBy: { employeeNo: "asc" },
    });
    const pend = await prisma.payslip.groupBy({
      by: ["teacherId"],
      where: { status: "GENERATED" },
      _sum: { net: true },
    });
    const map = new Map(pend.map((p) => [p.teacherId, p._sum.net ?? 0]));
    res.json({
      items: teachers.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        employeeNo: t.employeeNo,
        staffType: t.staffType,
        pendingSalary: map.get(t.id) ?? 0,
      })),
    });
  })
);

// ── Create (auto-computes pending salary + net payable) ──────────────────────
const createSchema = z.object({
  teacherId: z.string(),
  lastWorkingDay: z.coerce.date().nullish(),
  bonus: z.number().int().min(0).default(0),
  deductions: z.number().int().min(0).default(0),
  notes: z.string().nullish(),
});

settlementsRouter.post(
  "/",
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const d = createSchema.parse(req.body);
    const teacher = await prisma.teacher.findUnique({ where: { id: d.teacherId } });
    if (!teacher) throw ApiError.notFound("Staff member not found");

    const pendingSalary = await pendingSalaryFor(d.teacherId);
    const netPayable = pendingSalary + d.bonus - d.deductions;

    const settlement = await prisma.settlement.create({
      data: {
        teacherId: d.teacherId,
        lastWorkingDay: d.lastWorkingDay ?? null,
        pendingSalary,
        bonus: d.bonus,
        deductions: d.deductions,
        netPayable,
        notes: d.notes ?? null,
        createdById: req.user!.sub,
      },
      include,
    });
    res.status(201).json(settlement);
  })
);

// ── Approve / reject (approval marks the staff member inactive) ──────────────
const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().nullish(),
});

settlementsRouter.post(
  "/:id/decision",
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { decision, note } = decisionSchema.parse(req.body);
    const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
    if (!settlement) throw ApiError.notFound("Settlement not found");
    if (settlement.status !== "PENDING") {
      throw ApiError.badRequest("Only pending settlements can be approved or rejected");
    }
    const updated = await prisma.settlement.update({
      where: { id: settlement.id },
      data: {
        status: decision,
        decidedById: req.user!.sub,
        decisionNote: note ?? null,
        decidedAt: new Date(),
      },
      include,
    });
    // Approving a final settlement marks the staff member as having left.
    if (decision === "APPROVED") {
      await prisma.teacher.update({ where: { id: settlement.teacherId }, data: { isActive: false } });
    }
    audit(req, `settlement.${decision.toLowerCase()}`, `${decision === "APPROVED" ? "Approved" : "Rejected"} settlement — net ₹${settlement.netPayable.toLocaleString("en-IN")}`, { type: "Settlement", id: settlement.id });
    res.json(updated);
  })
);

// ── Mark paid ────────────────────────────────────────────────────────────────
settlementsRouter.post(
  "/:id/pay",
  requireRole(...PAY),
  asyncHandler(async (req, res) => {
    const settlement = await prisma.settlement.findUnique({ where: { id: req.params.id } });
    if (!settlement) throw ApiError.notFound("Settlement not found");
    if (settlement.status !== "APPROVED") {
      throw ApiError.badRequest("Only approved settlements can be marked paid");
    }
    // Pay the settlement AND clear the unpaid payslips it settled, in one
    // transaction — otherwise those payslips stay GENERATED and can be paid a
    // second time via payroll (or re-snapshotted into another settlement).
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.settlement.update({
        where: { id: settlement.id },
        data: { status: "PAID", paidAt: new Date() },
        include,
      });
      await tx.payslip.updateMany({
        where: { teacherId: settlement.teacherId, status: "GENERATED" },
        data: { status: "PAID", paidAt: new Date() },
      });
      return u;
    });
    audit(req, "settlement.pay", `Paid settlement — net ₹${settlement.netPayable.toLocaleString("en-IN")}`, { type: "Settlement", id: settlement.id });
    res.json(updated);
  })
);
