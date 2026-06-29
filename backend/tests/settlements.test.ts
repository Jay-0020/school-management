import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, loginAs } from "./helpers";

async function seedTeacherWithPayslip(net: number) {
  const tag = randomUUID().slice(0, 8);
  const teacher = await db.teacher.create({
    data: { employeeNo: `EMP-${tag}`, firstName: "Pay", lastName: "Roll" },
  });
  const payslip = await db.payslip.create({
    data: {
      teacherId: teacher.id,
      month: "2026-04",
      basic: net,
      hra: 0,
      da: 0,
      conveyance: 0,
      specialAllowance: 0,
      gross: net,
      pf: 0,
      esi: 0,
      professionalTax: 0,
      tds: 0,
      totalDeductions: 0,
      net,
      status: "GENERATED",
    },
  });
  return { teacher, payslip };
}

let auth: Awaited<ReturnType<typeof loginAs>>;

beforeAll(async () => {
  await db.user.update({ where: { email: ADMIN.email }, data: { mustChangePassword: false } });
  auth = await loginAs(ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("settlements — F&F payout marks payslips PAID (B3)", () => {
  it("paying a settlement clears the staff's unpaid payslips, blocking double-pay", async () => {
    const { teacher, payslip } = await seedTeacherWithPayslip(50000);

    // Create settlement (snapshots pendingSalary from GENERATED payslips).
    const created = await auth
      .post("/api/settlements")
      .set("Host", HOST)
      .send({ teacherId: teacher.id, bonus: 0, deductions: 0 });
    expect(created.status).toBe(201);
    expect(created.body.pendingSalary).toBe(50000);
    const settlementId = created.body.id;

    // Approve, then pay.
    const decided = await auth
      .post(`/api/settlements/${settlementId}/decision`)
      .set("Host", HOST)
      .send({ decision: "APPROVED" });
    expect(decided.status).toBe(200);

    const paid = await auth.post(`/api/settlements/${settlementId}/pay`).set("Host", HOST).send({});
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("PAID");

    // The payslip must now be PAID …
    const ps = await db.payslip.findUnique({ where: { id: payslip.id } });
    expect(ps?.status).toBe("PAID");

    // … and paying it again via payroll must be rejected (no double-pay).
    const again = await auth.post(`/api/payroll/payslips/${payslip.id}/pay`).set("Host", HOST).send({});
    expect(again.status).toBe(400);
  });

  it("payroll won't pay an already-paid payslip", async () => {
    const { payslip } = await seedTeacherWithPayslip(30000);
    const first = await auth.post(`/api/payroll/payslips/${payslip.id}/pay`).set("Host", HOST).send({});
    expect(first.status).toBe(200);
    const second = await auth.post(`/api/payroll/payslips/${payslip.id}/pay`).set("Host", HOST).send({});
    expect(second.status).toBe(400);
  });
});
