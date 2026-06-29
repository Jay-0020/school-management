import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, HOST, db, loginAs } from "./helpers";

const tag = () => randomUUID().slice(0, 8);

async function seedTeacherUser() {
  const t = tag();
  const email = `teach-${t}@test.local`;
  const password = "Teach@1234";
  const user = await db.user.create({
    data: { email, passwordHash: await argon2.hash(password), role: "TEACHER", mustChangePassword: false },
  });
  const teacher = await db.teacher.create({
    data: { employeeNo: `EMP-${t}`, firstName: "Tee", lastName: "Cher", userId: user.id },
  });
  return { email, password, user, teacher };
}

async function seedClassSection() {
  const t = tag();
  const cls = await db.class.create({ data: { name: `Class-${t}` } });
  const section = await db.section.create({ data: { name: `Sec-${t}`, classId: cls.id } });
  return { cls, section };
}

async function seedStudentIn(sectionId: string) {
  return db.student.create({
    data: { admissionNo: `ADM-${tag()}`, firstName: "Stu", lastName: "Dent", sectionId, status: "ACTIVE" },
  });
}

let admin: Awaited<ReturnType<typeof loginAs>>;

beforeAll(async () => {
  await db.user.update({ where: { email: ADMIN.email }, data: { mustChangePassword: false } });
  admin = await loginAs(ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("attendance — teacher section scoping (H1)", () => {
  it("blocks a teacher from a section they don't teach, but allows admin", async () => {
    const { email, password } = await seedTeacherUser();
    const teacher = await loginAs(email, password);
    const { section } = await seedClassSection();

    const denied = await teacher
      .get(`/api/attendance?sectionId=${section.id}&date=2026-07-01`)
      .set("Host", HOST);
    expect(denied.status).toBe(403);

    const ok = await admin
      .get(`/api/attendance?sectionId=${section.id}&date=2026-07-01`)
      .set("Host", HOST);
    expect(ok.status).toBe(200);
  });

  it("rejects marking a student who isn't in the section", async () => {
    const { section } = await seedClassSection();
    const { section: other } = await seedClassSection();
    const outsider = await seedStudentIn(other.id);

    const res = await admin
      .post("/api/attendance")
      .set("Host", HOST)
      .send({ sectionId: section.id, date: "2026-07-01", entries: [{ studentId: outsider.id, status: "PRESENT" }] });
    expect(res.status).toBe(400);
  });
});

describe("exam marks — class + subject scoping (HI-1, H2)", () => {
  it("rejects marks for a student not in the exam's class (HI-1)", async () => {
    const { cls: classA } = await seedClassSection();
    const { section: secB } = await seedClassSection();
    const outsider = await seedStudentIn(secB.id);
    const subject = await db.subject.create({ data: { name: `Subj-${tag()}` } });
    const exam = await db.exam.create({ data: { name: "Term 1", classId: classA.id } });
    const paper = await db.examPaper.create({ data: { examId: exam.id, subjectId: subject.id, maxMarks: 100 } });

    const res = await admin
      .post(`/api/exams/${exam.id}/marks`)
      .set("Host", HOST)
      .send({ paperId: paper.id, entries: [{ studentId: outsider.id, marksObtained: 50 }] });
    expect(res.status).toBe(400);
  });

  it("blocks a teacher from entering marks for a subject they don't teach (H2)", async () => {
    const { email, password } = await seedTeacherUser();
    const teacher = await loginAs(email, password);
    const { cls, section } = await seedClassSection();
    const student = await seedStudentIn(section.id);
    const subject = await db.subject.create({ data: { name: `Subj-${tag()}` } });
    const exam = await db.exam.create({ data: { name: "Term 1", classId: cls.id } });
    const paper = await db.examPaper.create({ data: { examId: exam.id, subjectId: subject.id, maxMarks: 100 } });

    const res = await teacher
      .post(`/api/exams/${exam.id}/marks`)
      .set("Host", HOST)
      .send({ paperId: paper.id, entries: [{ studentId: student.id, marksObtained: 50 }] });
    expect(res.status).toBe(403);
  });
});
