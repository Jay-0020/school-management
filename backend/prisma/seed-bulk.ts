/**
 * DEMO dataset — populates a school instance with realistic, presentable data
 * across every module so the whole product can be shown live.
 *
 *   • 12 grades × 3 sections (36 sections), each with a class teacher
 *   • 600 students, 100 staff (80 teaching + 20 non-teaching)
 *   • one clean login per role (password: Demo@1234)
 *   • ~20 school days of attendance, fees + payments, PUBLISHED exams + marks
 *     (report cards), 2 months of payroll, notices, homework, leave, expenses
 *
 * Run:  npx tsx prisma/seed-bulk.ts      (DATABASE_URL must point at the target)
 *
 * ⚠️  DESTRUCTIVE: wipes all data tables first (keeps only SchoolSettings) and
 *     rebuilds a fresh demo. Intended for demo / fresh instances, not a school
 *     with live data.
 */
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRST = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
  "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Riya", "Myra", "Kiara",
  "Kabir", "Aryan", "Dhruv", "Kayra", "Ira", "Mira", "Veer", "Advik", "Rudra", "Tara",
  "Neha", "Pooja", "Rahul", "Amit", "Sneha", "Karan", "Priya", "Suresh", "Meera", "Nikhil",
];
const LAST = [
  "Sharma", "Verma", "Patel", "Nair", "Rao", "Iyer", "Reddy", "Gupta", "Mehta", "Shah",
  "Joshi", "Kulkarni", "Banerjee", "Das", "Menon", "Chopra", "Bose", "Pillai", "Khanna", "Sinha",
];
const SUBJECTS = [
  "English", "Hindi", "Mathematics", "Science", "Social Studies",
  "Computer Science", "Physical Education", "Art",
];
const EXAM_SUBJECTS = ["English", "Hindi", "Mathematics", "Science", "Social Studies"];

const NUM_STUDENTS = 600;
const NUM_STAFF = 100;
const SECTIONS = ["A", "B", "C"];
const NUM_GRADES = 12;

// deterministic pseudo-random so reruns are stable
let s = 12345;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const pad = (n: number, w = 3) => String(n).padStart(w, "0");
const phone = () => `+91-9${Math.floor(100000000 + rnd() * 899999999)}`;
const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const now = new Date();
const dayUTC = (offset: number) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
const monthStr = (back: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}`;
};

async function wipe() {
  console.log("Wiping existing data (keeping SchoolSettings)…");
  // New modules first (they FK to teacher/student/user/section/subject).
  await prisma.teacherRating.deleteMany();
  await prisma.studentFeedback.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.teachingAssignment.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.staffAttendance.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.mark.deleteMany();
  await prisma.examPaper.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.note.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.student.deleteMany();
  await prisma.section.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await wipe();

  // ── Subjects ───────────────────────────────────────────────────────────
  await prisma.subject.createMany({
    data: SUBJECTS.map((name, i) => ({ name, code: `SUB${pad(i + 1)}` })),
  });
  const subjects = await prisma.subject.findMany();
  const subjByName = new Map(subjects.map((x) => [x.name, x.id]));

  // ── Classes ────────────────────────────────────────────────────────────
  console.log(`Creating ${NUM_GRADES} grades…`);
  const classes: { id: string; order: number }[] = [];
  for (let g = 1; g <= NUM_GRADES; g++) {
    const c = await prisma.class.create({ data: { name: `Grade ${g}`, order: g } });
    classes.push({ id: c.id, order: g });
  }

  // ── Staff (100) ────────────────────────────────────────────────────────
  console.log(`Creating ${NUM_STAFF} staff…`);
  const numTeaching = 80;
  await prisma.teacher.createMany({
    data: Array.from({ length: NUM_STAFF }, (_, i) => {
      const teaching = i < numTeaching;
      return {
        employeeNo: `EMP${pad(i + 1)}`,
        firstName: pick(FIRST),
        lastName: pick(LAST),
        staffType: teaching ? "TEACHING" : "NON_TEACHING",
        qualifications: teaching ? pick(["B.Ed, M.A.", "M.Sc, B.Ed", "B.Ed, M.Com", "M.A, Ph.D"]) : null,
        joiningDate: dayUTC(-Math.floor(rnd() * 1500)),
        phone: phone(),
        email: `${teaching ? "teacher" : "staff"}${i + 1}@greenwood.demo`,
      };
    }),
  });
  const teachers = await prisma.teacher.findMany({ orderBy: { employeeNo: "asc" } });

  // ── Sections (36) with class teachers ──────────────────────────────────
  console.log(`Creating ${NUM_GRADES * SECTIONS.length} sections…`);
  const sections: { id: string; classId: string }[] = [];
  let ctIdx = 0;
  for (const c of classes) {
    for (const name of SECTIONS) {
      const sec = await prisma.section.create({
        data: { name, classId: c.id, classTeacherId: teachers[ctIdx % numTeaching].id },
      });
      sections.push({ id: sec.id, classId: c.id });
      ctIdx++;
    }
  }
  const classBySection = new Map(sections.map((x) => [x.id, x.classId]));

  // ── Students (600) ─────────────────────────────────────────────────────
  console.log(`Creating ${NUM_STUDENTS} students…`);
  await prisma.student.createMany({
    data: Array.from({ length: NUM_STUDENTS }, (_, i) => ({
      admissionNo: `ADM${pad(i + 1, 4)}`,
      firstName: pick(FIRST),
      lastName: pick(LAST),
      gender: rnd() > 0.5 ? "Male" : "Female",
      dateOfBirth: dayUTC(-(2000 + Math.floor(rnd() * 2500))),
      sectionId: sections[i % sections.length].id,
      guardianName: `${pick(FIRST)} ${pick(LAST)}`,
      guardianPhone: phone(),
      address: `${Math.floor(rnd() * 200)}, ${pick(["MG Road", "Park Street", "Gandhi Nagar", "Civil Lines"])}`,
      status: "ACTIVE",
    })),
  });
  const students = await prisma.student.findMany({
    select: { id: true, sectionId: true },
    orderBy: { admissionNo: "asc" },
  });

  // ── Fee structures + invoices + payments ───────────────────────────────
  console.log("Creating fee structures, invoices, payments…");
  const feeData: any[] = [];
  const tuitionByClass = new Map<string, number>();
  for (const c of classes) {
    const tuition = 15000 + c.order * 1000;
    tuitionByClass.set(c.id, tuition);
    feeData.push({ classId: c.id, name: "Tuition - Term 1", amount: tuition });
    feeData.push({ classId: c.id, name: "Transport - Term 1", amount: 8000 });
  }
  await prisma.feeStructure.createMany({ data: feeData });

  await prisma.invoice.createMany({
    data: students.map((st, i) => {
      const classId = classBySection.get(st.sectionId!)!;
      const total = (tuitionByClass.get(classId) ?? 15000) + 8000;
      const bucket = i % 4; // 0,1 PAID ; 2 PARTIAL ; 3 PENDING
      const status = bucket < 2 ? "PAID" : bucket === 2 ? "PARTIAL" : "PENDING";
      const amountPaid = status === "PAID" ? total : status === "PARTIAL" ? Math.round(total / 2) : 0;
      return { studentId: st.id, title: "Term 1 Fees 2026-27", total, amountPaid, status, dueDate: dayUTC(15) };
    }),
  });
  const invoices = await prisma.invoice.findMany({
    select: { id: true, studentId: true, total: true, amountPaid: true, status: true },
  });
  const invByStudent = new Map(invoices.map((x) => [x.studentId, x]));
  const items: any[] = [];
  const payments: any[] = [];
  for (const st of students) {
    const inv = invByStudent.get(st.id)!;
    const classId = classBySection.get(st.sectionId!)!;
    items.push({ invoiceId: inv.id, name: "Tuition - Term 1", amount: tuitionByClass.get(classId) ?? 15000 });
    items.push({ invoiceId: inv.id, name: "Transport - Term 1", amount: 8000 });
    if (inv.amountPaid > 0) {
      payments.push({ invoiceId: inv.id, amount: inv.amountPaid, method: pick(["UPI", "BANK_TRANSFER", "CASH", "CARD"]), reference: `TXN${Math.floor(rnd() * 1e9)}`, paidAt: dayUTC(-Math.floor(rnd() * 30)) });
    }
  }
  for (const c of chunk(items, 2000)) await prisma.invoiceItem.createMany({ data: c });
  for (const c of chunk(payments, 2000)) await prisma.payment.createMany({ data: c });

  // ── Attendance (last ~20 school days) ──────────────────────────────────
  console.log("Generating attendance (last 20 school days)…");
  const days: Date[] = [];
  for (let i = 1; days.length < 20 && i < 40; i++) {
    const d = dayUTC(-i);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  const attendance: any[] = [];
  for (const st of students) {
    for (const date of days) {
      const r = rnd();
      const status = r < 0.88 ? "PRESENT" : r < 0.94 ? "ABSENT" : r < 0.98 ? "LATE" : "EXCUSED";
      attendance.push({ studentId: st.id, sectionId: st.sectionId, date, status });
    }
  }
  let att = 0;
  for (const c of chunk(attendance, 5000)) {
    await prisma.attendanceRecord.createMany({ data: c, skipDuplicates: true });
    att += c.length;
  }
  console.log(`  ${att} attendance records`);

  // ── Exams + papers + marks (PUBLISHED → report cards) ──────────────────
  console.log("Creating exams, papers, marks (report cards)…");
  const studentsByClass = new Map<string, string[]>();
  for (const st of students) {
    const cid = classBySection.get(st.sectionId!)!;
    (studentsByClass.get(cid) ?? studentsByClass.set(cid, []).get(cid)!).push(st.id);
  }
  let markCount = 0;
  for (const c of classes) {
    const exam = await prisma.exam.create({
      data: { name: "Term 1 Examination", classId: c.id, term: "Term 1", examDate: dayUTC(-10), status: "PUBLISHED" },
    });
    const marks: any[] = [];
    for (const subjName of EXAM_SUBJECTS) {
      const paper = await prisma.examPaper.create({
        data: { examId: exam.id, subjectId: subjByName.get(subjName)!, maxMarks: 100, passMarks: 33 },
      });
      for (const studentId of studentsByClass.get(c.id) ?? []) {
        marks.push({ examId: exam.id, paperId: paper.id, studentId, marksObtained: 30 + Math.floor(rnd() * 68) });
      }
    }
    for (const mc of chunk(marks, 5000)) await prisma.mark.createMany({ data: mc });
    markCount += marks.length;
  }
  console.log(`  ${markCount} marks across ${classes.length} published exams`);

  // ── Payroll: salary structures + 2 months of payslips ──────────────────
  console.log("Creating payroll (salary structures + 2 months payslips)…");
  await prisma.salaryStructure.createMany({
    data: teachers.map((t, i) => {
      const basic = 20000 + (i % 10) * 2500;
      return { teacherId: t.id, basic, hra: Math.round(basic * 0.4), da: Math.round(basic * 0.1), conveyance: 1600, specialAllowance: 2000, pfApplicable: true, esiApplicable: false, professionalTax: 200, tdsMonthly: i % 3 === 0 ? 1500 : 0 };
    }),
  });
  const payslips: any[] = [];
  for (const t of teachers) {
    const idx = teachers.indexOf(t);
    const basic = 20000 + (idx % 10) * 2500;
    const hra = Math.round(basic * 0.4), da = Math.round(basic * 0.1), conveyance = 1600, specialAllowance = 2000;
    const gross = basic + hra + da + conveyance + specialAllowance;
    const pf = Math.round(basic * 0.12);
    const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const professionalTax = 200, tds = idx % 3 === 0 ? 1500 : 0;
    const totalDeductions = pf + esi + professionalTax + tds;
    for (const back of [1, 0]) {
      payslips.push({ teacherId: t.id, month: monthStr(back), basic, hra, da, conveyance, specialAllowance, gross, pf, esi, professionalTax, tds, totalDeductions, net: gross - totalDeductions, status: back === 1 ? "PAID" : "GENERATED", paidAt: back === 1 ? dayUTC(-15) : null });
    }
  }
  for (const c of chunk(payslips, 2000)) await prisma.payslip.createMany({ data: c });

  // ── Logins: one clean account per role (Demo@1234) ─────────────────────
  console.log("Creating role logins…");
  const hash = await argon2.hash("Demo@1234");
  const mkUser = (email: string, role: string) =>
    prisma.user.create({ data: { email, passwordHash: hash, role: role as any, mustChangePassword: false } });

  const superadmin = await mkUser("superadmin@greenwood.demo", "SUPER_ADMIN");
  const admin = await mkUser("admin@greenwood.demo", "ADMIN");
  const dean = await mkUser("dean@greenwood.demo", "DEAN");
  const accountant = await mkUser("accountant@greenwood.demo", "ACCOUNTANT");
  const teacherUser = await mkUser("teacher@greenwood.demo", "TEACHER");
  const studentUser = await mkUser("student@greenwood.demo", "STUDENT");
  const parentUser = await mkUser("parent@greenwood.demo", "PARENT");

  // Link the teacher login to the class teacher of Grade 1-A so they see a section.
  await prisma.teacher.update({ where: { id: teachers[0].id }, data: { userId: teacherUser.id } });
  // Link the student login + parent to two pupils in that same section.
  const g1aStudents = students.filter((x) => x.sectionId === sections[0].id).slice(0, 2);
  await prisma.student.update({ where: { id: g1aStudents[0].id }, data: { userId: studentUser.id, parentId: parentUser.id } });
  if (g1aStudents[1]) await prisma.student.update({ where: { id: g1aStudents[1].id }, data: { parentId: parentUser.id } });

  // ── Notices ────────────────────────────────────────────────────────────
  await prisma.notice.createMany({
    data: [
      { title: "Welcome to the 2026-27 Academic Year", body: "Classes begin Monday. Please check the timetable on the notice board.", audience: "ALL", pinned: true, authorId: admin.id },
      { title: "Parent-Teacher Meeting", body: "PTM scheduled this Saturday from 9 AM to 1 PM.", audience: "STUDENTS", authorId: admin.id },
      { title: "Staff Meeting", body: "All teaching staff to assemble in the conference hall at 3 PM Friday.", audience: "STAFF", authorId: dean.id },
      { title: "Annual Sports Day", body: "Sports Day will be held next month. Registrations open now.", audience: "ALL", pinned: true, authorId: admin.id },
      { title: "Fee Payment Reminder", body: "Term 1 fees are due by the 15th. Pay online or at the accounts office.", audience: "STUDENTS", authorId: accountant.id },
      { title: "Library Week", body: "Special book exhibition in the library all week.", audience: "ALL", authorId: admin.id },
    ],
  });

  // ── Homework (first 12 sections, by the demo teacher) ──────────────────
  await prisma.homework.createMany({
    data: sections.slice(0, 12).flatMap((sec) => [
      { title: "Math worksheet — Chapter 3", description: "Complete exercises 1–10.", sectionId: sec.id, subjectId: subjByName.get("Mathematics")!, dueDate: dayUTC(3), assignedById: teacherUser.id },
      { title: "English essay", description: "Write 300 words on 'My Favourite Festival'.", sectionId: sec.id, subjectId: subjByName.get("English")!, dueDate: dayUTC(5), assignedById: teacherUser.id },
    ]),
  });

  // ── Leave requests (hierarchy: teacher → dean) ─────────────────────────
  await prisma.leaveRequest.createMany({
    data: [
      { applicantId: teacherUser.id, kind: "ADVANCE", category: "CASUAL", fromDate: dayUTC(4), toDate: dayUTC(4), reason: "Family function", status: "PENDING" },
      { applicantId: teacherUser.id, kind: "JUSTIFICATION", category: "SICK", fromDate: dayUTC(-3), toDate: dayUTC(-3), reason: "Fever, could not inform in advance", status: "APPROVED", approverId: dean.id, decidedAt: dayUTC(-2), decisionNote: "Approved. Get well soon." },
      { applicantId: dean.id, kind: "ADVANCE", category: "CASUAL", fromDate: dayUTC(10), toDate: dayUTC(12), reason: "Personal travel", status: "PENDING" },
      { applicantId: accountant.id, kind: "ADVANCE", category: "CASUAL", fromDate: dayUTC(6), toDate: dayUTC(6), reason: "Bank work", status: "REJECTED", approverId: admin.id, decidedAt: dayUTC(-1), decisionNote: "Month-end closing; please reschedule." },
    ],
  });

  // ── Expenses ───────────────────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      { category: "Maintenance", description: "Classroom fan repairs", amount: 4500, expenseDate: dayUTC(-12), status: "PAID", submittedById: accountant.id, decidedById: admin.id, decidedAt: dayUTC(-10), paidAt: dayUTC(-8) },
      { category: "Supplies", description: "Whiteboard markers and chalk (bulk)", amount: 3200, expenseDate: dayUTC(-9), status: "APPROVED", submittedById: accountant.id, decidedById: admin.id, decidedAt: dayUTC(-7) },
      { category: "Events", description: "Sports Day decorations", amount: 12000, expenseDate: dayUTC(-5), status: "SUBMITTED", submittedById: dean.id },
      { category: "Utilities", description: "Electricity bill — September", amount: 28500, expenseDate: dayUTC(-3), status: "SUBMITTED", submittedById: accountant.id },
      { category: "Transport", description: "School bus servicing", amount: 9800, expenseDate: dayUTC(-15), status: "PAID", submittedById: accountant.id, decidedById: admin.id, decidedAt: dayUTC(-13), paidAt: dayUTC(-11) },
    ],
  });

  // ── A few notifications (so the bell shows unread) ─────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: dean.id, message: "New leave request from a teacher awaiting your approval." },
      { userId: admin.id, message: "2 expenses submitted for your review." },
      { userId: teacherUser.id, message: "Your sick-leave justification was approved." },
      { userId: accountant.id, message: "8 invoices are still pending payment." },
    ],
  });

  // ── Summary ────────────────────────────────────────────────────────────
  const [studentCount, staffCount, invCount] = await Promise.all([
    prisma.student.count(), prisma.teacher.count(), prisma.invoice.count(),
  ]);
  console.log("\n✅ Demo data ready.");
  console.log(`   ${studentCount} students · ${staffCount} staff · ${att} attendance · ${markCount} marks · ${invCount} invoices · ${payslips.length} payslips`);
  console.log("\n🔑 Logins (password: Demo@1234)");
  console.log("   SUPER_ADMIN  superadmin@greenwood.demo");
  console.log("   ADMIN        admin@greenwood.demo");
  console.log("   DEAN         dean@greenwood.demo");
  console.log("   ACCOUNTANT   accountant@greenwood.demo");
  console.log("   TEACHER      teacher@greenwood.demo   (class teacher, Grade 1-A)");
  console.log("   STUDENT      student@greenwood.demo   (Grade 1-A)");
  console.log("   PARENT       parent@greenwood.demo    (2 children in Grade 1-A)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
