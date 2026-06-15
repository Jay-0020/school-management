import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

interface Stat {
  key: string;
  label: string;
  value: string;
  hint?: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Outstanding fees across all unpaid/partial invoices. */
async function feesOutstanding(): Promise<number> {
  const agg = await prisma.invoice.aggregate({
    where: { status: { in: ["PENDING", "PARTIAL"] } },
    _sum: { total: true, amountPaid: true },
  });
  return (agg._sum.total ?? 0) - (agg._sum.amountPaid ?? 0);
}

/**
 * Dean / Admin financial overview — fees pending, staff payments pending,
 * salary paid to date, and total expenditure (with a category breakdown).
 */
dashboardRouter.get(
  "/finance",
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN"),
  asyncHandler(async (_req, res) => {
    const [feesAgg, staffPending, salaryPaid, expPaid, expByCat] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: { in: ["PENDING", "PARTIAL"] } },
        _sum: { total: true, amountPaid: true },
      }),
      prisma.payslip.aggregate({ where: { status: "GENERATED" }, _sum: { net: true } }),
      prisma.payslip.aggregate({ where: { status: "PAID" }, _sum: { net: true } }),
      prisma.expense.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      feesPending: (feesAgg._sum.total ?? 0) - (feesAgg._sum.amountPaid ?? 0),
      staffPaymentsPending: staffPending._sum.net ?? 0,
      salaryPaidToDate: salaryPaid._sum.net ?? 0,
      totalExpenditure: expPaid._sum.amount ?? 0,
      expenditureByCategory: expByCat
        .map((c) => ({ category: c.category, total: c._sum.amount ?? 0 }))
        .sort((a, b) => b.total - a.total),
    });
  })
);

/** Role-aware dashboard: a set of headline stats plus recent notices. */
dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.user!;
    const stats: Stat[] = [];

    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      const [students, staff, outstanding, pendingExp, classes] = await Promise.all([
        prisma.student.count({ where: { status: "ACTIVE" } }),
        prisma.teacher.count({ where: { isActive: true } }),
        feesOutstanding(),
        prisma.expense.count({ where: { status: "SUBMITTED" } }),
        prisma.class.count(),
      ]);
      stats.push(
        { key: "students", label: "Active students", value: String(students) },
        { key: "staff", label: "Active staff", value: String(staff) },
        { key: "fees", label: "Fees outstanding", value: inr(outstanding) },
        {
          key: "expenses",
          label: "Expenses to review",
          value: String(pendingExp),
          hint: "awaiting approval",
        },
        { key: "classes", label: "Classes", value: String(classes) }
      );
    } else if (role === "DEAN") {
      const [students, staff, pendingLeave] = await Promise.all([
        prisma.student.count({ where: { status: "ACTIVE" } }),
        prisma.teacher.count({ where: { isActive: true } }),
        prisma.leaveRequest.count({
          where: { status: "PENDING", applicant: { role: { in: ["TEACHER", "ACCOUNTANT"] } } },
        }),
      ]);
      stats.push(
        { key: "students", label: "Students", value: String(students) },
        { key: "staff", label: "Staff", value: String(staff) },
        {
          key: "leave",
          label: "Staff leave to review",
          value: String(pendingLeave),
          hint: "pending approval",
        }
      );
    } else if (role === "ACCOUNTANT") {
      const [outstanding, pendingExp, staff] = await Promise.all([
        feesOutstanding(),
        prisma.expense.count({ where: { status: "SUBMITTED" } }),
        prisma.teacher.count({ where: { isActive: true } }),
      ]);
      stats.push(
        { key: "fees", label: "Fees outstanding", value: inr(outstanding) },
        { key: "expenses", label: "Expenses to review", value: String(pendingExp) },
        { key: "staff", label: "Payroll staff", value: String(staff) }
      );
    } else if (role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({ where: { userId: sub } });
      const [homework, myExpenses, sections] = await Promise.all([
        prisma.homework.count({ where: { assignedById: sub } }),
        prisma.expense.count({ where: { submittedById: sub } }),
        teacher
          ? prisma.section.count({ where: { classTeacherId: teacher.id } })
          : Promise.resolve(0),
      ]);
      stats.push(
        { key: "homework", label: "Homework assigned", value: String(homework) },
        { key: "sections", label: "Classes I lead", value: String(sections) },
        { key: "expenses", label: "My expense claims", value: String(myExpenses) }
      );
    } else if (role === "STUDENT" || role === "PARENT") {
      const student = await prisma.student.findUnique({ where: { userId: sub } });
      if (student) {
        const [invoiceAgg, homework] = await Promise.all([
          prisma.invoice.aggregate({
            where: { studentId: student.id, status: { in: ["PENDING", "PARTIAL"] } },
            _sum: { total: true, amountPaid: true },
          }),
          student.sectionId
            ? prisma.homework.count({ where: { sectionId: student.sectionId } })
            : Promise.resolve(0),
        ]);
        const dues = (invoiceAgg._sum.total ?? 0) - (invoiceAgg._sum.amountPaid ?? 0);
        stats.push(
          { key: "dues", label: "Fees due", value: inr(dues) },
          { key: "homework", label: "Homework items", value: String(homework) }
        );
      }
    }

    // Recent notices visible to this role (pinned first).
    let noticeWhere = {};
    if (role === "TEACHER" || role === "ACCOUNTANT") {
      noticeWhere = { audience: { in: ["ALL", "STAFF", "SECTION"] } };
    } else if (role === "STUDENT" || role === "PARENT") {
      noticeWhere = { audience: { in: ["ALL", "STUDENTS"] } };
    }
    const notices = await prisma.notice.findMany({
      where: noticeWhere,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, pinned: true, createdAt: true },
    });

    res.json({ stats, notices });
  })
);
