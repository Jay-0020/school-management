/**
 * Bulk demo data: grades/sections, 20 teachers (class teachers), non-teaching
 * staff, accountants, 200 students, ~8 weeks of attendance, sample leave, and a
 * few logins (a Dean, a class teacher, a student) for testing the hierarchy.
 *
 * Run: npm run seed:bulk   (safe to re-run — clears its own demo rows first by tag)
 */
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
  "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Riya", "Myra", "Kiara",
  "Kabir", "Aryan", "Dhruv", "Kayra", "Ira", "Mira", "Veer", "Advik", "Rudra", "Tara",
];
const LAST = [
  "Sharma", "Verma", "Patel", "Nair", "Rao", "Iyer", "Reddy", "Gupta", "Mehta", "Shah",
  "Joshi", "Kulkarni", "Banerjee", "Das", "Menon", "Chopra", "Bose", "Pillai", "Khanna", "Sinha",
];

// deterministic pseudo-random so reruns are stable
let s = 12345;
function rnd() {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const pad = (n: number) => String(n).padStart(3, "0");

async function main() {
  console.log("Clearing previous bulk demo rows…");
  // Identify bulk rows by their tagged identifiers.
  await prisma.attendanceRecord.deleteMany({
    where: { student: { admissionNo: { startsWith: "B-" } } },
  });
  await prisma.leaveRequest.deleteMany({
    where: { applicant: { OR: [{ email: { contains: "+bulk@" } }] } },
  });
  await prisma.student.deleteMany({ where: { admissionNo: { startsWith: "B-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "+bulk@" } } });
  await prisma.teacher.deleteMany({ where: { employeeNo: { startsWith: "B-" } } });
  await prisma.section.deleteMany({ where: { class: { name: { startsWith: "Grade " } } } });
  await prisma.class.deleteMany({ where: { name: { startsWith: "Grade " } } });

  console.log("Creating grades, sections, teachers…");
  const grades = Array.from({ length: 10 }, (_, i) => i + 1);
  const sectionsCreated: { id: string; classId: string }[] = [];
  let teacherIdx = 0;
  const teachers: { id: string; userLink?: boolean }[] = [];

  for (const g of grades) {
    const cls = await prisma.class.create({ data: { name: `Grade ${g}`, order: g } });
    for (const sec of ["A", "B"]) {
      teacherIdx++;
      const t = await prisma.teacher.create({
        data: {
          employeeNo: `B-T${pad(teacherIdx)}`,
          firstName: pick(FIRST),
          lastName: pick(LAST),
          staffType: "TEACHING",
          email: `teacher${teacherIdx}+bulk@demoschool.in`,
        },
      });
      teachers.push({ id: t.id });
      const section = await prisma.section.create({
        data: { name: sec, classId: cls.id, classTeacherId: t.id },
      });
      sectionsCreated.push({ id: section.id, classId: cls.id });
    }
  }
  console.log(`  ${grades.length} grades, ${sectionsCreated.length} sections, ${teacherIdx} teachers`);

  console.log("Creating non-teaching staff + accountants…");
  for (let i = 1; i <= 5; i++) {
    await prisma.teacher.create({
      data: {
        employeeNo: `B-S${pad(i)}`,
        firstName: pick(FIRST),
        lastName: pick(LAST),
        staffType: "NON_TEACHING",
      },
    });
  }
  const acctHash = await argon2.hash("Test@1234");
  for (let i = 1; i <= 3; i++) {
    await prisma.user.create({
      data: {
        email: `accountant${i}+bulk@demoschool.in`,
        passwordHash: acctHash,
        role: "ACCOUNTANT",
        mustChangePassword: false,
      },
    });
  }

  console.log("Creating 200 students…");
  let admN = 0;
  const studentIds: { id: string; sectionId: string }[] = [];
  for (const section of sectionsCreated) {
    for (let k = 0; k < 10; k++) {
      admN++;
      const st = await prisma.student.create({
        data: {
          admissionNo: `B-${pad(admN)}`,
          firstName: pick(FIRST),
          lastName: pick(LAST),
          gender: rnd() > 0.5 ? "Male" : "Female",
          sectionId: section.id,
          guardianName: `${pick(FIRST)} ${pick(LAST)}`,
          guardianPhone: `+91-9${Math.floor(100000000 + rnd() * 899999999)}`,
          status: "ACTIVE",
        },
      });
      studentIds.push({ id: st.id, sectionId: section.id });
    }
  }
  console.log(`  ${studentIds.length} students`);

  console.log("Generating ~8 weeks of attendance…");
  // Build the last 56 days, weekdays only (UTC midnight).
  const today = new Date();
  const days: Date[] = [];
  for (let i = 1; i <= 56; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  let attCount = 0;
  for (const st of studentIds) {
    const data = days.map((date) => {
      const r = rnd();
      const status = r < 0.88 ? "PRESENT" : r < 0.94 ? "ABSENT" : r < 0.98 ? "LATE" : "EXCUSED";
      return { studentId: st.id, sectionId: st.sectionId, date, status: status as const };
    });
    await prisma.attendanceRecord.createMany({ data, skipDuplicates: true });
    attCount += data.length;
  }
  console.log(`  ${attCount} attendance records`);

  console.log("Sample leave requests…");
  // A couple of pending student requests in the first section + a staff one.
  const firstSectionStudents = studentIds.filter((x) => x.sectionId === sectionsCreated[0].id).slice(0, 3);
  const hash = await argon2.hash("Test@1234");
  // give the first class teacher + first student logins so the chain is testable
  const t0 = teachers[0];
  const ct = await prisma.user.create({
    data: { email: "classteacher+bulk@demoschool.in", passwordHash: hash, role: "TEACHER", mustChangePassword: false },
  });
  await prisma.teacher.update({ where: { id: t0.id }, data: { userId: ct.id } });
  const pupilStudent = firstSectionStudents[0];
  const pupil = await prisma.user.create({
    data: { email: "pupil+bulk@demoschool.in", passwordHash: hash, role: "STUDENT", mustChangePassword: false },
  });
  await prisma.student.update({ where: { id: pupilStudent.id }, data: { userId: pupil.id } });

  // dean login
  await prisma.user.upsert({
    where: { email: "dean@demoschool.in" },
    update: { role: "DEAN", mustChangePassword: false },
    create: { email: "dean@demoschool.in", passwordHash: hash, role: "DEAN", mustChangePassword: false },
  });

  const inDays = (n: number) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n));
  // pupil's pending advance request → goes to class teacher
  await prisma.leaveRequest.create({
    data: {
      applicantId: pupil.id,
      kind: "ADVANCE",
      fromDate: inDays(3),
      toDate: inDays(3),
      reason: "Family function",
    },
  });
  // class teacher's pending request → goes to dean
  await prisma.leaveRequest.create({
    data: {
      applicantId: ct.id,
      kind: "JUSTIFICATION",
      fromDate: inDays(-2),
      toDate: inDays(-2),
      reason: "Was unwell, could not inform in advance",
    },
  });

  console.log("\n✅ Bulk seed complete.");
  console.log("Sample logins (password Test@1234):");
  console.log("  Dean:          dean@demoschool.in");
  console.log("  Class teacher: classteacher+bulk@demoschool.in");
  console.log("  Student:       pupil+bulk@demoschool.in");
  console.log("  Accountants:   accountant1+bulk@demoschool.in … accountant3+bulk@demoschool.in");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
