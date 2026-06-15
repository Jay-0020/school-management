// Generates a branded "Live Demo Guide" PDF — overview, end-to-end flow,
// logins, and a per-role feature walkthrough.
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
const BOTTOM = doc.page.height - 60; // safe content bottom

function ensure(space) {
  if (doc.y + space > BOTTOM) doc.addPage();
}

function band(title, subtitle) {
  doc.rect(0, 0, doc.page.width, 100).fill(INDIGO);
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(23).text(title, L, 30);
  if (subtitle) doc.font("Helvetica").fontSize(12).fill("#e0e7ff").text(subtitle, L, 64);
  doc.fill("#000000");
  doc.y = 120;
}

function h2(t) {
  ensure(60);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(15).fill(DARK).text(t, L);
  const y = doc.y + 2;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.5).stroke(INDIGO);
  doc.moveDown(0.5).fill("#000000");
}

function para(t) {
  ensure(40);
  doc.font("Helvetica").fontSize(10.5).fill(GREY).text(t, L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.35);
}

function steps(items) {
  doc.fontSize(10.5);
  items.forEach((it, i) => {
    ensure(34);
    const [head, body] = it.split("::");
    const n = `${i + 1}.`;
    doc.font("Helvetica-Bold").fill(INDIGO).text(n, L, doc.y, { width: 20, continued: false });
    const top = doc.y - doc.currentLineHeight();
    doc.font("Helvetica-Bold").fill(DARK).text(head.trim() + "  ", L + 22, top, { continued: true });
    doc.font("Helvetica").fill(GREY).text(body.trim(), { width: W - 22, lineGap: 1 });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.2);
}

function bullets(items) {
  doc.fontSize(10.5);
  for (const it of items) {
    ensure(26);
    const [head, body] = it.split("::");
    doc.font("Helvetica-Bold").fill("#334155").text("•  " + head.trim() + " ", L, doc.y, { continued: true, indent: 4 });
    if (body) doc.font("Helvetica").fill(GREY).text(body.trim(), { lineGap: 1 });
    else doc.text("");
  }
  doc.moveDown(0.3);
}

// ── Cover ──────────────────────────────────────────────────────────────────
band("School Management Portal", "Live Demo — Access & Feature Guide");

doc.font("Helvetica-Bold").fontSize(12).fill(DARK).text("Try the live demo:", L);
doc.moveDown(0.2);
const boxY = doc.y;
doc.rect(L, boxY, W, 32).fill(LIGHT);
doc.fill(INDIGO).font("Helvetica-Bold").fontSize(14).text(LIVE_URL, L + 12, boxY + 9, { width: W - 24, link: LIVE_URL });
doc.y = boxY + 44;
doc.fill("#000000");

para("This is a fully working, pre-loaded demo of the portal — a complete, white-label school management system. It already contains a realistic school of 600 students and 100 staff, with live fees, attendance, exams, report cards, payroll and more. Use the logins inside to explore every role.");
doc.font("Helvetica-Oblique").fontSize(9.5).fill(GREY).text(
  "Note: the demo runs on a free server that sleeps when idle, so the very first page load can take 30–60 seconds to wake up — then it's fast. Works on desktop and mobile, in any browser.",
  L, doc.y, { width: W, lineGap: 2 });
doc.moveDown(0.1).fill("#000000");

// ── What it is ──────────────────────────────────────────────────────────────
h2("What it is");
para("A single platform that runs everything a school does day to day — admissions, academics, attendance, exams and report cards, fee collection, staff payroll, leave, expenses and parent communication — in one place, replacing scattered registers, spreadsheets and WhatsApp groups.");
para("It is white-label and multi-school: each school gets its own private, branded instance (its own logo, colours and isolated data), all running from one shared product. There are seven roles — Admin, Super Admin, Dean, Accountant, Teacher, Student and Parent — and each person sees only what's relevant to them.");

// ── End-to-end flow ──────────────────────────────────────────────────────────
h2("How a school uses it — end to end");
steps([
  "Set up the school :: Admin sets the name, logo, colours and academic year, then creates classes, sections and subjects.",
  "Add staff :: Add teachers and non-teaching staff, and assign a class teacher to each section.",
  "Admit students :: Add students, place them in sections, and link parent accounts.",
  "Run the day :: Teachers mark daily attendance, assign homework, and share notes/study material with their class.",
  "Communicate :: Admins post notices (to everyone, to students, to staff, or to a single section); everyone gets in-app notifications.",
  "Examinations :: Create exams, enter marks subject-by-subject, then publish — report cards become visible to students and parents and export to PDF.",
  "Fees :: Generate invoices per class, collect payments (cash / UPI / bank / card), and track who's paid, partial or pending.",
  "Payroll :: Define salary structures and generate monthly payslips with India statutory deductions (PF, ESI, Professional Tax, TDS).",
  "Leave & approvals :: Staff apply for leave against quotas; requests flow up the hierarchy (teacher → dean / admin) for approval.",
  "Expenses :: Staff submit expense claims; admins approve, reject or mark them paid.",
  "Oversight :: Admins and the Dean see the whole school; parents track each child's attendance, results and fees.",
]);

// ── Logins ───────────────────────────────────────────────────────────────────
h2("Login credentials");
para("Open the URL above, then sign in with any of these. The password is the same for every account:");
ensure(24);
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
const cols = [78, 188, W - 78 - 188];
ensure(rows.length * 22 + 10);
let ty = doc.y;
rows.forEach((r, i) => {
  const head = i === 0;
  const rowH = 22;
  doc.rect(L, ty, W, rowH).fill(head ? INDIGO : i % 2 ? "#f8fafc" : "#ffffff");
  let cx = L + 8;
  r.forEach((cell, c) => {
    doc.font(head || c === 0 ? "Helvetica-Bold" : "Helvetica")
       .fontSize(head ? 10 : 9.5)
       .fill(head ? "#ffffff" : c === 1 ? INDIGO : "#334155")
       .text(cell, cx, ty + 6, { width: cols[c] - 10, lineBreak: false });
    cx += cols[c];
  });
  ty += rowH;
});
doc.y = ty + 8;
doc.fill("#000000");
para("Tip: every account works immediately — no password change needed. The Teacher, Student and Parent above are all linked to the same class (Grade 1-A), so you can follow one class across all three views.");

// ── Feature walkthrough ────────────────────────────────────────────────────
doc.addPage();
band("Feature Walkthrough", "What to try in each role");

h2("Admin / Super Admin  —  runs the whole school");
bullets([
  "School Setup :: rebrand the school — name, logo, colour, contact, academic year (the white-label control).",
  "Students :: browse all 600, search/filter, add or edit a student, view a full profile.",
  "Staff & Teachers :: 100 staff records; assign class teachers; teaching vs non-teaching.",
  "Classes & Sections :: 12 grades × 3 sections, each with a class teacher.",
  "Fees :: fee structures per class, auto-generated invoices, record payments, paid / partial / pending.",
  "Payroll :: salary structures and monthly payslips with PF, ESI, Professional Tax and TDS.",
  "Expenses :: review and approve / reject / mark-paid expense claims.",
  "Exams & Report Cards :: published Term-1 exams across all classes; report cards export to PDF.",
  "Notices :: post announcements to everyone, students, staff, or one section.",
  "Notes & Notifications :: moderate shared study material; in-app alerts via the bell icon.",
]);

h2("Dean  —  oversight & approvals");
bullets([
  "Leave approvals :: approve or reject staff leave (there are pending requests waiting).",
  "Oversight :: view staff, students, attendance and notices across the school.",
  "Hierarchy :: teacher leave flows up to the Dean — raise one as Teacher, then approve it here.",
]);

h2("Accountant  —  money");
bullets([
  "Invoices & collection :: every student's fee invoice and outstanding balance.",
  "Record payments :: take a payment (cash, UPI, bank transfer, card) against an invoice.",
  "Dashboards :: paid vs partial vs pending at a glance (300 / 150 / 150 in the demo).",
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
  "Attendance :: own attendance record and percentage.",
  "Report card :: view and download the Term-1 report card as a PDF.",
  "Fees :: invoices and what's paid / due.",
  "Homework & Notes :: assigned homework and class study material.",
  "Notices :: announcements meant for students.",
]);

h2("Parent  —  stay informed");
bullets([
  "Children :: this parent has 2 children in Grade 1-A — switch between them.",
  "Attendance & report cards :: track each child and download report cards.",
  "Fees :: each child's fee status and dues.",
  "Notices :: school and student announcements.",
]);

h2("Nice touches to point out");
bullets([
  "Light / dark mode :: toggle in the top bar.",
  "Fully responsive :: open the same URL on a phone.",
  "Secure by design :: role-based access, hashed passwords, data isolated per school.",
  "PDF exports :: report cards and payslips export to print-ready PDFs.",
]);

// ── Footer on every page (margin disabled so it never spills to a new page) ──
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(8).fill("#94a3b8")
     .text(`School Management Portal — Live Demo Guide        Page ${i + 1} of ${range.count}`,
       L, doc.page.height - 35, { width: W, align: "center", lineBreak: false });
  doc.page.margins.bottom = savedBottom;
}

doc.end();
console.log("PDF written to:", OUT);
