import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, loginAs } from "./helpers";

// A staff applicant with a small casual quota and a known password.
async function seedStaff(casualQuota: number) {
  const tag = randomUUID().slice(0, 8);
  const email = `staff-${tag}@test.local`;
  const password = "Staff@1234";
  await db.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password),
      role: "TEACHER",
      casualQuota,
      mustChangePassword: false,
    },
  });
  return { email, password };
}

let admin: Awaited<ReturnType<typeof loginAs>>;

beforeAll(async () => {
  await db.user.update({ where: { email: ADMIN.email }, data: { mustChangePassword: false } });
  admin = await loginAs(ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await db.$disconnect();
});

const advance = (from: string, to: string) => ({
  kind: "ADVANCE",
  category: "CASUAL",
  fromDate: from,
  toDate: to,
  reason: "test",
});

describe("leave — quota enforced at approval (B4)", () => {
  it("rejects a single ADVANCE request that exceeds the quota at apply time", async () => {
    const { email, password } = await seedStaff(5);
    const staff = await loginAs(email, password);
    const res = await staff
      .post("/api/leave")
      .set("Host", HOST)
      .send(advance("2026-07-01", "2026-07-06")); // 6 days > 5
    expect(res.status).toBe(400);
  });

  it("blocks stacking pending requests past the quota at approval", async () => {
    const { email, password } = await seedStaff(5);
    const staff = await loginAs(email, password);

    // Two 3-day requests: each passes apply (0 used), together = 6 > quota 5.
    const r1 = await staff.post("/api/leave").set("Host", HOST).send(advance("2026-07-01", "2026-07-03"));
    const r2 = await staff.post("/api/leave").set("Host", HOST).send(advance("2026-08-01", "2026-08-03"));
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    // Admin approves the first (3 ≤ 5) …
    const a1 = await admin
      .post(`/api/leave/${r1.body.id}/decision`)
      .set("Host", HOST)
      .send({ decision: "APPROVED" });
    expect(a1.status).toBe(200);

    // … but the second now exceeds the balance (3 used + 3 > 5) → rejected.
    const a2 = await admin
      .post(`/api/leave/${r2.body.id}/decision`)
      .set("Host", HOST)
      .send({ decision: "APPROVED" });
    expect(a2.status).toBe(400);

    // The second request stays PENDING (not approved).
    const after = await db.leaveRequest.findUnique({ where: { id: r2.body.id } });
    expect(after?.status).toBe("PENDING");
  });
});
