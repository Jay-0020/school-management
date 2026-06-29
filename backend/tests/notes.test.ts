import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, loginAs } from "./helpers";

const tag = () => randomUUID().slice(0, 8);

async function seedUser(role: "STUDENT" | "TEACHER") {
  const email = `${role.toLowerCase()}-${tag()}@test.local`;
  const password = "Pass@1234";
  await db.user.create({
    data: { email, passwordHash: await argon2.hash(password), role, mustChangePassword: false },
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

describe("notes — staff-only upload + filters + pagination", () => {
  it("lets staff upload (auto-approved) but blocks students with 403", async () => {
    const up = await admin
      .post("/api/notes")
      .set("Host", HOST)
      .field("title", "Algebra sheet")
      .attach("file", Buffer.from("algebra notes"), "algebra.txt");
    expect(up.status).toBe(201);
    expect(up.body.status).toBe("APPROVED"); // no moderation step anymore

    const { email, password } = await seedUser("STUDENT");
    const student = await loginAs(email, password);
    const denied = await student
      .post("/api/notes")
      .set("Host", HOST)
      .field("title", "Hack")
      .attach("file", Buffer.from("x"), "x.txt");
    expect(denied.status).toBe(403);

    // students can still VIEW (read-only) and see the school-wide note
    const list = await student.get("/api/notes").set("Host", HOST);
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("total");
    expect(list.body.items.some((n: { title: string }) => n.title === "Algebra sheet")).toBe(true);
  });

  it("filters by subject and by file type, and paginates", async () => {
    const subject = await db.subject.create({ data: { name: `Subj-${tag()}` } });
    await admin
      .post("/api/notes")
      .set("Host", HOST)
      .field("title", "Tagged note")
      .field("subjectId", subject.id)
      .attach("file", Buffer.from("doc body"), "note.txt"); // text/plain → "doc" group

    const bySubject = await admin.get(`/api/notes?subjectId=${subject.id}`).set("Host", HOST);
    expect(bySubject.body.items.length).toBe(1);
    expect(bySubject.body.items[0].subject.id).toBe(subject.id);

    // text/plain is in the "doc" group, not "pdf"
    const asDoc = await admin.get(`/api/notes?subjectId=${subject.id}&type=doc`).set("Host", HOST);
    expect(asDoc.body.items.length).toBe(1);
    const asPdf = await admin.get(`/api/notes?subjectId=${subject.id}&type=pdf`).set("Host", HOST);
    expect(asPdf.body.items.length).toBe(0);

    // pagination envelope present
    const paged = await admin.get("/api/notes?page=1&pageSize=1").set("Host", HOST);
    expect(paged.body).toMatchObject({ page: 1, pageSize: 1 });
    expect(paged.body.items.length).toBeLessThanOrEqual(1);
  });
});
