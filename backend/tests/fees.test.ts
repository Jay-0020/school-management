import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, http, loginAs } from "./helpers";

// Seed a class → section → student and return ids. Unique names per run.
async function seedStudent() {
  const tag = randomUUID().slice(0, 8);
  const cls = await db.class.create({ data: { name: `FeeClass-${tag}` } });
  const section = await db.section.create({
    data: { name: `A-${tag}`, classId: cls.id },
  });
  const student = await db.student.create({
    data: {
      admissionNo: `ADM-${tag}`,
      firstName: "Test",
      lastName: "Student",
      sectionId: section.id,
      status: "ACTIVE",
    },
  });
  return { student };
}

async function newInvoice(studentId: string, total: number) {
  return db.invoice.create({
    data: { studentId, title: `Inv-${randomUUID().slice(0, 6)}`, total },
  });
}

let auth: Awaited<ReturnType<typeof loginAs>>;

beforeAll(async () => {
  // Make the seeded admin usable via the API regardless of the (soon-enforced)
  // mustChangePassword gate.
  await db.user.update({
    where: { email: ADMIN.email },
    data: { mustChangePassword: false },
  });
  auth = await loginAs(ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("fees — payment recording (B1 race + B2 overpay)", () => {
  it("rejects a payment that exceeds the outstanding balance (B2)", async () => {
    const { student } = await seedStudent();
    const inv = await newInvoice(student.id, 1000);

    const first = await auth
      .post(`/api/fees/invoices/${inv.id}/payments`)
      .set("Host", HOST)
      .send({ amount: 600, method: "CASH" });
    expect(first.status).toBe(201);

    const second = await auth
      .post(`/api/fees/invoices/${inv.id}/payments`)
      .set("Host", HOST)
      .send({ amount: 600, method: "CASH" }); // 600 + 600 > 1000
    expect(second.status).toBe(400);

    const after = await db.invoice.findUnique({ where: { id: inv.id } });
    expect(after?.amountPaid).toBe(600); // NOT 1200
    expect(after?.status).toBe("PARTIAL");
    const payments = await db.payment.count({ where: { invoiceId: inv.id } });
    expect(payments).toBe(1); // the rejected one rolled back
  });

  it("two concurrent full-balance payments → exactly one succeeds, no overpay (B1)", async () => {
    const { student } = await seedStudent();
    const inv = await newInvoice(student.id, 1000);

    const fire = () =>
      auth
        .post(`/api/fees/invoices/${inv.id}/payments`)
        .set("Host", HOST)
        .send({ amount: 1000, method: "CASH" });

    const [a, b] = await Promise.all([fire(), fire()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]); // one wins, one rejected

    const after = await db.invoice.findUnique({ where: { id: inv.id } });
    expect(after?.amountPaid).toBe(1000); // NOT 2000
    expect(after?.status).toBe("PAID");
    const payments = await db.payment.count({ where: { invoiceId: inv.id } });
    expect(payments).toBe(1);
  });

  it("a normal partial → full payment sequence settles correctly", async () => {
    const { student } = await seedStudent();
    const inv = await newInvoice(student.id, 1000);

    const p1 = await auth.post(`/api/fees/invoices/${inv.id}/payments`).set("Host", HOST).send({ amount: 400, method: "UPI" });
    expect(p1.status).toBe(201);
    let cur = await db.invoice.findUnique({ where: { id: inv.id } });
    expect(cur?.status).toBe("PARTIAL");
    expect(cur?.amountPaid).toBe(400);

    const p2 = await auth.post(`/api/fees/invoices/${inv.id}/payments`).set("Host", HOST).send({ amount: 600, method: "CASH" });
    expect(p2.status).toBe(201);
    cur = await db.invoice.findUnique({ where: { id: inv.id } });
    expect(cur?.status).toBe("PAID");
    expect(cur?.amountPaid).toBe(1000);
  });
});
