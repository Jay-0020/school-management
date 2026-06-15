// Generates a branded "Live Demo Guide" PDF — logins + full feature walkthrough.
// Run from backend/:  node make-demo-guide.mjs
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LIVE_URL = "https://school-demo-nnfb.onrender.com";
const OUT = join(homedir(), "Desktop", "School-Portal-Demo-Guide.pdf");

const INDIGO = "#4f46e5";
const DARK = "#1e1b4b";
const GREY = "#475569";
const LIGHT = "#eef2ff";

const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
doc.pipe(createWriteStream(OUT));

const W = doc.page.width - 100; // usable width
const L = 50;

function band(title, subtitle) {
  doc.rect(0, 0, doc.page.width, 110).fill(INDIGO);
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(24).text(title, L, 34);
  if (subtitle) doc.font("Helvetica").fontSize(12).fill("#e0e7ff").text(subtitle, L, 70);
  doc.fill("#000000");
  doc.y = 135;
}

function h2(t) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(15).fill(DARK).text(t, L);
  const y = doc.y + 2;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.5).stroke(INDIGO);
  doc.moveDown(0.5).fill("#000000");
}

function para(t) {
  doc.font("Helvetica").fontSize(10.5).fill(GREY).text(t, L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.3);
}

function bullets(items) {
  doc.font("Helvetica").fontSize(10.5).fill("#334155");
  for (const it of items) {
    if (doc.y > doc.page.height - 70) doc.addPage();
    const parts = it.split("::");
    if (parts.length === 2) {
      doc.font("Helvetica-Bold").text("•  " + parts[0].trim() + " ", { continued: true, indent: 6 });
      doc.font("Helvetica").fill(GREY).text(parts[1].trim(), { lineGap: 1 });
    } else {
      doc.font("Helvetica").fill("#334155").text("•  " + it, { indent: 6, lineGap: 1 });
    }
  }
  doc.moveDown(0.3);
}

// ── Cover ──────────────────────────────────────────────────────────────────
band("School Management Portal", "Live Demo — Access & Feature Guide");

doc.font("Helvetica-Bold").fontSize(12).fill(DARK).text("Try the live demo:", L);
doc.moveDown(0.2);
doc.rect(L, doc.y, W, 34).fill(LIGHT);
doc.fill(INDIGO).font("Helvetica-Bold").fontSize(14).text(LIVE_URL, L + 12, doc.y + 9, { width: W - 24, link: LIVE_URL, underline: false });
doc.y += 44;
doc.fill("#000000");

para("This is a fully working, pre-loaded demo of the portal — a complete white-label school management system. It already contains a realistic school: 600 students, 100 staff, fees, attendance, exams with report cards, payroll, notices and more. Use the logins below to explore every role.");

doc.font("Helvetica-Oblique").fontSize(9.5).fill(GREY).text(
  "Note: the demo runs on a free server that sleeps when idle — the very first page load can take 30–60 seconds to wake up, then it's fast. Works on desktop and mobile, in any browser.",
  L, doc.y, { width: W, lineGap: 2 }
);
doc.moveDown(0.2).fill("#000000");

// ── Logins ───────────────────────────────────────────────────────────────
h2("Login credentials");
para("Open the URL above, then sign in with any of these. Password for all accounts is the same:");
doc.font("Helvetica-Bold").fontSize(12).fill(DARK).text("Password (all roles):  Demo@1234", L);
doc.moveDown(0.5);

const rows = [
  ["Role", "Email", "What they can do"],
  ["Admin", "admin@greenwood.demo", "Full access — everything below"],
  ["Super Admin", "superadmin@greenwood.demo", "Same as Admin + system-level access"],
  ["Dean", "dean@greenwood.demo", "Approves staff leave; school oversight"],
  ["Accountant", "accountant@greenwood.demo", "Fees, invoices, payments, expenses"],
  ["Teacher", "teacher@greenwood.demo", "Attendance, homework, marks, notes, leave"],
  ["Student", "student@greenwood.demo", "Own attendance, report card, fees, notes"],
  ["Parent", "parent@greenwood.demo", "Child's attendance, report card, fees"],
];
const cols = [78, 190, W - 78 - 190];
let ty = doc.y;
rows.forEach((r, i) => {
  const head = i === 0;
  const rowH = 22;
  if (ty > doc.page.height - 60) { doc.addPage(); ty = 60; }
  doc.rect(L, ty, W, rowH).fill(head ? INDIGO : i % 2 ? "#f8fafc" : "#ffffff");
  let cx = L + 8;
  r.forEach((cell, c) => {
    doc.font(head ? "Helvetica-Bold" : c === 0 ? "Helvetica-Bold" : "Helvetica")
       .fontSize(head ? 10 : 9.5)
       .fill(head ? "#ffffff" : c === 1 ? INDIGO : "#334155")
       .text(cell, cx, ty + 6, { width: cols[c] - 10, lineBreak: false });
    cx += cols[c];
  });
  ty += rowH;
});
doc.y = ty + 6;
doc.fill("#000000");
para("Tip: every account is ready to use — no password change needed. The teacher, student and parent above are all linked to the same class (Grade 1-A), so you can follow one class across all three roles.");

// ── Feature walkthrough ────────────────────────────────────────────────────
doc.addPage();
band("Feature Walkthrough", "What to try in each role");

h2("Admin / Super Admin  —  runs the whole school");
bullets([
  "School Setup :: rebrand the school — name, logo, colour, contact, academic year (this is the white-label control).",
  "Students :: browse all 600, search/filter, add or edit a student, view a full profile.",
  "Staff & Teachers :: 100 staff records; assign class teachers; mark teaching vs non-teaching.",
  "Classes & Sections :: 12 grades × 3 sections, each with a class teacher.",
  "Fees :: fee structures per class, auto-generated invoices, record payments, see paid / partial / pending.",
  "Payroll :: salary structures and monthly payslips with India statutory deductions (PF, ESI, Professional Tax, TDS).",
  "Expenses :: review and approve / reject / mark-paid expense claims.",
  "Exams & Report Cards :: published Term-1 exams across all classes; view and export report cards as PDF.",
  "Notices :: post announcements to everyone, students, staff, or a single section.",
  "Notes :: moderate and share study material / file uploads.",
  "Notifications :: in-app alerts for approvals and reminders (bell icon).",
]);

h2("Dean  —  oversight & approvals");
bullets([
  "Leave approvals :: approve or reject staff leave requests (there are pending ones waiting).",
  "Oversight :: view staff, students, attendance and notices across the school.",
  "Hierarchy :: teacher leave flows up to the Dean — sign in as Teacher, raise a request, then approve it here.",
]);

h2("Accountant  —  money");
bullets([
  "Invoices & collection :: see every student's fee invoice and outstanding balance.",
  "Record payments :: take a payment (cash, UPI, bank transfer, card) against an invoice.",
  "Dashboards :: paid vs partial vs pending at a glance (300 paid, 150 partial, 150 pending in the demo).",
  "Expenses :: submit and track school expenses.",
]);

h2("Teacher  —  day to day");
bullets([
  "Attendance :: mark daily attendance for the assigned section (Grade 1-A).",
  "Homework :: assign homework with due dates and subjects.",
  "Marks :: enter exam marks for students.",
  "Notes :: upload and share study material with the class.",
  "Leave :: apply for leave and see remaining quota (casual / sick / earned).",
  "Payslips :: view own monthly payslips.",
]);

h2("Student  —  self-service");
bullets([
  "Attendance :: see own attendance record and percentage.",
  "Report card :: view and download the Term-1 report card as a PDF.",
  "Fees :: see invoices and what's paid / due.",
  "Homework & Notes :: view assigned homework and class study material.",
  "Notices :: read announcements meant for students.",
]);

h2("Parent  —  stay informed");
bullets([
  "Children :: this parent has 2 children in Grade 1-A — switch between them.",
  "Attendance & report cards :: track each child's attendance and download report cards.",
  "Fees :: see each child's fee status and dues.",
  "Notices :: read school and student announcements.",
]);

h2("Nice touches to point out");
bullets([
  "Light / dark mode :: toggle in the top bar.",
  "Fully responsive :: open the same URL on a phone.",
  "Secure by design :: role-based access — each person sees only what they should; passwords hashed; data isolated per school.",
  "PDF exports :: report cards and payslips export to print-ready PDFs.",
]);

// ── Footer on every page ────────────────────────────────────────────────────
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  doc.font("Helvetica").fontSize(8).fill("#94a3b8")
     .text(`School Management Portal — Live Demo Guide        Page ${i + 1} of ${range.count}`,
       L, doc.page.height - 35, { width: W, align: "center" });
}

doc.end();
console.log("PDF written to:", OUT);
