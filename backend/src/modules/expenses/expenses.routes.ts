import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const expensesRouter = Router();

expensesRouter.use(authenticate);

const STAFF = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER"] as const;
const APPROVERS = ["SUPER_ADMIN", "ADMIN"] as const;
const PAYERS = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] as const;

const include = {
  submittedBy: { select: { id: true, email: true, role: true } },
  decidedBy: { select: { id: true, email: true } },
} satisfies Prisma.ExpenseInclude;

function isManager(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "ACCOUNTANT";
}

// ── Submit ──────────────────────────────────────────────────────────────────
const createSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().int().positive(),
  expenseDate: z.coerce.date().nullish(),
});

expensesRouter.post(
  "/",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const expense = await prisma.expense.create({
      data: {
        category: data.category,
        description: data.description,
        amount: data.amount,
        expenseDate: data.expenseDate ?? null,
        submittedById: req.user!.sub,
      },
      include,
    });
    res.status(201).json(expense);
  })
);

// ── List & detail ─────────────────────────────────────────────────────────
expensesRouter.get(
  "/",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const where: Prisma.ExpenseWhereInput = {};
    if (!isManager(role)) {
      where.submittedById = sub; // teachers see only their own
    } else if (req.query.status) {
      where.status = req.query.status as Prisma.ExpenseWhereInput["status"];
    }
    const items = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include,
    });
    res.json({ items });
  })
);

expensesRouter.get(
  "/summary",
  requireRole(...PAYERS),
  asyncHandler(async (_req, res) => {
    const grouped = await prisma.expense.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: true,
    });
    const summary = grouped.map((g) => ({
      status: g.status,
      count: g._count,
      total: g._sum.amount ?? 0,
    }));
    res.json({ summary });
  })
);

expensesRouter.get(
  "/:id",
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id }, include });
    if (!expense) throw ApiError.notFound("Expense not found");
    const { role, sub } = req.user!;
    if (!isManager(role) && expense.submittedById !== sub) throw ApiError.forbidden();
    res.json(expense);
  })
);

// ── Decision (approve / reject) ─────────────────────────────────────────────
const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().nullish(),
});

expensesRouter.post(
  "/:id/decision",
  requireRole(...APPROVERS),
  asyncHandler(async (req, res) => {
    const { decision, note } = decisionSchema.parse(req.body);
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) throw ApiError.notFound("Expense not found");
    if (expense.status !== "SUBMITTED") {
      throw ApiError.badRequest("Only submitted expenses can be approved or rejected");
    }
    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: {
        status: decision,
        decidedById: req.user!.sub,
        decisionNote: note ?? null,
        decidedAt: new Date(),
      },
      include,
    });
    res.json(updated);
  })
);

// ── Mark paid ────────────────────────────────────────────────────────────────
expensesRouter.post(
  "/:id/pay",
  requireRole(...PAYERS),
  asyncHandler(async (req, res) => {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) throw ApiError.notFound("Expense not found");
    if (expense.status !== "APPROVED") {
      throw ApiError.badRequest("Only approved expenses can be marked paid");
    }
    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: { status: "PAID", paidAt: new Date() },
      include,
    });
    res.json(updated);
  })
);
