import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { streamPdf, field, table, inr } from "../../lib/pdf";
import { authenticate, requireRole } from "../../middleware/auth";
import { audit } from "../../lib/audit";

export const feesRouter = Router();

feesRouter.use(authenticate);

const MANAGERS = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] as const;

/** Recompute an invoice's paid total and status from its payments. */
async function recomputeInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return;
  const amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  let status: Prisma.InvoiceUpdateInput["status"] = invoice.status;
  if (invoice.status !== "CANCELLED") {
    if (amountPaid <= 0) status = "PENDING";
    else if (amountPaid >= invoice.total) status = "PAID";
    else status = "PARTIAL";
  }
  await prisma.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status } });
}

// ── Fee structures (per class) ──────────────────────────────────────────────
feesRouter.get(
  "/structures",
  requireRole(...MANAGERS, "TEACHER"),
  asyncHandler(async (req, res) => {
    const classId = z.string().min(1).parse(req.query.classId);
    const items = await prisma.feeStructure.findMany({
      where: { classId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ items });
  })
);

const structureSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().int().positive(),
});

feesRouter.post(
  "/structures",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    const data = structureSchema.parse(req.body);
    const cls = await prisma.class.findUnique({ where: { id: data.classId } });
    if (!cls) throw ApiError.notFound("Class not found");
    const created = await prisma.feeStructure.create({ data });
    res.status(201).json(created);
  })
);

feesRouter.delete(
  "/structures/:id",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    await prisma.feeStructure.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

// ── Invoice generation (bulk for a class) ───────────────────────────────────
const generateSchema = z.object({
  classId: z.string().min(1),
  title: z.string().min(1),
  dueDate: z.coerce.date().nullish(),
});

feesRouter.post(
  "/invoices/generate",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    const { classId, title, dueDate } = generateSchema.parse(req.body);

    const structures = await prisma.feeStructure.findMany({ where: { classId } });
    if (structures.length === 0) {
      throw ApiError.badRequest("Add fee structures for this class first");
    }
    const total = structures.reduce((sum, s) => sum + s.amount, 0);

    const students = await prisma.student.findMany({
      where: { status: "ACTIVE", section: { classId } },
      select: { id: true },
    });
    if (students.length === 0) {
      throw ApiError.badRequest("No active students in this class");
    }

    let created = 0;
    let skipped = 0;
    for (const student of students) {
      const dupe = await prisma.invoice.findFirst({
        where: { studentId: student.id, title },
      });
      if (dupe) {
        skipped += 1;
        continue;
      }
      await prisma.invoice.create({
        data: {
          studentId: student.id,
          title,
          total,
          dueDate: dueDate ?? null,
          items: { create: structures.map((s) => ({ name: s.name, amount: s.amount })) },
        },
      });
      created += 1;
    }

    res.status(201).json({ created, skipped, total });
  })
);

// ── Invoices ────────────────────────────────────────────────────────────────
feesRouter.get(
  "/invoices",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 25);

    const where: Prisma.InvoiceWhereInput = {};
    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      where.studentId = student?.id ?? "__none__";
    } else if (role === "PARENT") {
      // A parent sees their children's invoices.
      const children = await prisma.student.findMany({ where: { parentId: sub }, select: { id: true } });
      where.studentId = { in: children.length ? children.map((c) => c.id) : ["__none__"] };
    } else {
      if (req.query.status) where.status = req.query.status as Prisma.InvoiceWhereInput["status"];
      if (req.query.sectionId) where.student = { sectionId: String(req.query.sectionId) };
      if (req.query.studentId) where.studentId = String(req.query.studentId);
    }

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNo: true,
              section: { select: { name: true, class: { select: { name: true } } } },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

feesRouter.get(
  "/invoices/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNo: true, userId: true, parentId: true },
        },
      },
    });
    if (!invoice) throw ApiError.notFound("Invoice not found");

    // Students/parents may only see their own invoice.
    const { role, sub } = req.user!;
    if ((role === "STUDENT" || role === "PARENT") && invoice.student.userId !== sub && invoice.student.parentId !== sub) {
      throw ApiError.forbidden();
    }
    res.json(invoice);
  })
);

// Invoice / receipt as a branded PDF (students/parents own; staff any).
feesRouter.get(
  "/invoices/:id/pdf",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        student: {
          select: { firstName: true, lastName: true, admissionNo: true, userId: true, parentId: true },
        },
      },
    });
    if (!invoice) throw ApiError.notFound("Invoice not found");
    const { role, sub } = req.user!;
    if ((role === "STUDENT" || role === "PARENT") && invoice.student.userId !== sub && invoice.student.parentId !== sub) {
      throw ApiError.forbidden();
    }
    const balance = invoice.total - invoice.amountPaid;
    await streamPdf(
      res,
      {
        filename: `fees-${invoice.student.admissionNo}-${invoice.id.slice(-6)}.pdf`,
        title: invoice.status === "PAID" ? "Fee Receipt" : "Fee Invoice",
        subtitle: invoice.title,
      },
      (doc) => {
        field(doc, "Student", `${invoice.student.firstName} ${invoice.student.lastName}`);
        field(doc, "Admission No", invoice.student.admissionNo);
        if (invoice.dueDate) field(doc, "Due Date", invoice.dueDate.toISOString().slice(0, 10));
        field(doc, "Status", invoice.status);
        doc.moveDown(0.5);
        table(
          doc,
          ["Fee item", "Amount"],
          invoice.items.map((it) => [it.name, inr(it.amount)]),
          [340, 160],
          "#000"
        );
        doc.moveDown(0.3);
        field(doc, "Total", inr(invoice.total));
        field(doc, "Paid", inr(invoice.amountPaid));
        field(doc, "Balance", inr(balance));
        if (invoice.payments.length) {
          doc.moveDown(0.5);
          doc.fillColor("#101828").fontSize(12).font("Helvetica-Bold").text("Payments", 48, doc.y);
          doc.moveDown(0.2);
          table(
            doc,
            ["Date", "Amount", "Method", "Ref"],
            invoice.payments.map((p) => [
              p.paidAt.toISOString().slice(0, 10),
              inr(p.amount),
              p.method,
              p.reference ?? "—",
            ]),
            [110, 130, 130, 130],
            "#000"
          );
        }
      }
    );
  })
);

const paymentSchema = z.object({
  amount: z.number().int().positive(),
  method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "ONLINE", "OTHER"]),
  reference: z.string().nullish(),
  paidAt: z.coerce.date().nullish(),
});

feesRouter.post(
  "/invoices/:id/payments",
  requireRole(...MANAGERS),
  asyncHandler(async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) throw ApiError.notFound("Invoice not found");
    if (invoice.status === "CANCELLED") throw ApiError.badRequest("Invoice is cancelled");

    const balance = invoice.total - invoice.amountPaid;
    if (data.amount > balance) {
      throw ApiError.badRequest(`Amount exceeds the outstanding balance (₹${balance})`);
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: data.amount,
        method: data.method,
        reference: data.reference ?? null,
        paidAt: data.paidAt ?? new Date(),
        recordedById: req.user!.sub,
      },
    });
    await recomputeInvoice(invoice.id);

    audit(req, "fee.payment", `Recorded payment ₹${data.amount.toLocaleString("en-IN")} (${data.method}) on invoice "${invoice.title}"`, { type: "Invoice", id: invoice.id });
    res.status(201).json(payment);
  })
);
