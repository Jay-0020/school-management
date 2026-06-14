import { Router } from "express";
import { z } from "zod";
import type { SalaryStructure } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const payrollRouter = Router();

payrollRouter.use(authenticate);

const MANAGERS = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] as const;

// India statutory thresholds.
const PF_WAGE_CEILING = 15000; // EPF computed on basic up to this
const PF_RATE = 0.12; // employee contribution
const ESI_GROSS_CEILING = 21000; // ESI applies only at/below this gross
const ESI_RATE = 0.0075; // employee contribution

/**
 * Compute a payslip breakdown from a salary structure.
 * - PF: 12% of basic, capped at the ₹15,000 wage ceiling.
 * - ESI: 0.75% of gross (rounded up), only when gross ≤ ₹21,000.
 * - Professional Tax and TDS: taken from the structure as configured.
 */
export function computePayslip(s: SalaryStructure) {
  const gross = s.basic + s.hra + s.da + s.conveyance + s.specialAllowance;
  const pf = s.pfApplicable ? Math.round(PF_RATE * Math.min(s.basic, PF_WAGE_CEILING)) : 0;
  const esi =
    s.esiApplicable && gross <= ESI_GROSS_CEILING ? Math.ceil(ESI_RATE * gross) : 0;
  const professionalTax = s.professionalTax;
  const tds = s.tdsMonthly;
  const totalDeductions = pf + esi + professionalTax + tds;
  return {
    basic: s.basic,
    hra: s.hra,
    da: s.da,
    conveyance: s.conveyance,
    specialAllowance: s.specialAllowance,
    gross,
    pf,
    esi,
    professionalTax,
    tds,
    totalDeductions,
    net: gross - totalDeductions,
  };
}

// ── Salary structures ───────────────────────────────────────────────────────
payrollRouter.get(
  "/structures",
  requireRole(...MANAGERS),
  asyncHandler(async (_req, res) => {
    const staff = await prisma.teacher.findMany({
      where: { isActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: { salaryStructure: true },
    });
    res.json({ items: staff });
  })
);

const structureSchema = z.object({
  basic: z.number().int().nonnegative(),
  hra: z.number().int().nonnegative().default(0),
  da: z.number().int().nonnegative().default(0),
  conveyance: z.number().int().nonnegative().default(0),
  specialAllowance: z.number().int().nonnegative().default(0),
  pfApplicable: z.boolean().default(true),
  esiApplicable: z.boolean().default(false),
  professionalTax: z.number().int().nonnegative().default(0),
  tdsMonthly: z.number().int().nonnegative().default(0),
});

payrollRouter.put(
  "/structures/:teacherId",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    const { teacherId } = req.params;
    const data = structureSchema.parse(req.body);
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw ApiError.notFound("Staff member not found");

    const structure = await prisma.salaryStructure.upsert({
      where: { teacherId },
      create: { teacherId, ...data },
      update: data,
    });
    res.json(structure);
  })
);

// ── Payroll run ─────────────────────────────────────────────────────────────
const runSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM") });

payrollRouter.post(
  "/run",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    const { month } = runSchema.parse(req.body);

    const staff = await prisma.teacher.findMany({
      where: { isActive: true, salaryStructure: { isNot: null } },
      include: { salaryStructure: true },
    });
    if (staff.length === 0) {
      throw ApiError.badRequest("No active staff have a salary structure yet");
    }

    let created = 0;
    let skipped = 0;
    for (const member of staff) {
      const existing = await prisma.payslip.findUnique({
        where: { teacherId_month: { teacherId: member.id, month } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const calc = computePayslip(member.salaryStructure!);
      await prisma.payslip.create({ data: { teacherId: member.id, month, ...calc } });
      created += 1;
    }

    res.status(201).json({ month, created, skipped });
  })
);

// ── Payslips ────────────────────────────────────────────────────────────────
const payslipInclude = {
  teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true, userId: true } },
} as const;

payrollRouter.get(
  "/payslips",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    if (role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({ where: { userId: sub } });
      const items = await prisma.payslip.findMany({
        where: { teacherId: teacher?.id ?? "__none__" },
        orderBy: { month: "desc" },
        include: payslipInclude,
      });
      return res.json({ items });
    }
    if (!["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(role)) throw ApiError.forbidden();

    const month = req.query.month ? String(req.query.month) : undefined;
    const items = await prisma.payslip.findMany({
      where: month ? { month } : {},
      orderBy: [{ month: "desc" }, { createdAt: "asc" }],
      include: payslipInclude,
    });
    res.json({ items });
  })
);

payrollRouter.get(
  "/payslips/:id",
  asyncHandler(async (req, res) => {
    const payslip = await prisma.payslip.findUnique({
      where: { id: req.params.id },
      include: payslipInclude,
    });
    if (!payslip) throw ApiError.notFound("Payslip not found");
    const { role, sub } = req.user!;
    if (role === "TEACHER" && payslip.teacher.userId !== sub) throw ApiError.forbidden();
    if (role === "STUDENT" || role === "PARENT") throw ApiError.forbidden();
    res.json(payslip);
  })
);

payrollRouter.post(
  "/payslips/:id/pay",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    const payslip = await prisma.payslip.findUnique({ where: { id: req.params.id } });
    if (!payslip) throw ApiError.notFound("Payslip not found");
    const updated = await prisma.payslip.update({
      where: { id: payslip.id },
      data: { status: "PAID", paidAt: new Date() },
      include: payslipInclude,
    });
    res.json(updated);
  })
);
