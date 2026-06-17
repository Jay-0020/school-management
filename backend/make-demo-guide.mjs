// Generates a branded "Live Demo Guide" PDF — overview, end-to-end flow,
// logins, and a per-role feature walkthrough.
// Run from backend/:  node make-demo-guide.mjs
import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LIVE_URL = "https://school-demo-nnfb.onrender.com";
const OUT = process.env.GUIDE_OUT || join(homedir(), "Desktop", "School-Portal-Demo-Guide.pdf");

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
  "School Setup :: branding, plus the campus location + radius (map) and the academic calendar (session dates, Saturday rule, holidays).",
  "Students & Parents :: browse all 600, filter by grade/section, link a parent account, mark a student as left, edit admission date.",
  "Teaching Assignments :: assign a teacher to each subject in each section.",
  "Staff & Teachers :: 100 staff records; class teachers; teaching vs non-teaching.",
  "Fees :: invoices, payments, paid / partial / pending.",
  "Payroll & Settlements :: payslips (PF/ESI/PT/TDS) and full-and-final settlements for leaving staff.",
  "Expenses :: fixed-category claims, approve / reject / mark paid.",
  "Exams & Report Cards :: exams have a start/end date range and a per-subject datesheet (each subject's date within that range); report cards export to PDF.",
  "Notices & Notifications :: announcements + in-app alerts (bell icon).",
]);

h2("Dean  —  oversight, approvals & the people view");
bullets([
  "Financial overview :: fees pending, staff payments pending, salary paid to date, total expenditure (by category).",
  "Enrolment :: new admissions vs students who left this session.",
  "Teacher performance :: every teacher's average rating + comments from students & parents.",
  "Approvals :: staff leave, expenses, and full-and-final settlements.",
  "Complaints :: review and resolve complaints about staff (only the Dean sees these).",
  "Calendar & people :: academic calendar, and filter all students/staff by grade/section.",
]);

h2("Accountant  —  money");
bullets([
  "Invoices & collection :: every student's fee invoice and outstanding balance.",
  "Record payments :: cash, UPI, bank transfer, card against an invoice.",
  "Dashboards :: paid vs partial vs pending at a glance.",
  "Expenses & settlements :: mark approved expenses and settlements as paid.",
]);

h2("Teacher  —  day to day");
bullets([
  "On-Campus check-in :: tap to mark attendance — only works inside the school geofence (from a phone).",
  "My rating :: see your average rating from students & parents (anonymous) on the dashboard.",
  "Student feedback :: open a student → add feedback or a commendation, and see their history.",
  "Attendance, Homework, Marks, Notes :: mark class attendance, set homework, enter marks, share material.",
  "Leave :: apply for casual / sick leave and see remaining quota.",
  "Payslips :: view own monthly payslips.",
]);

h2("Student  —  self-service");
bullets([
  "Rate your teachers :: give each of your teachers a 1–5★ rating + comment (anonymous).",
  "Feedback :: read feedback and commendations your teachers have left for you.",
  "Complaints :: raise a complaint about a staff member (optionally anonymous).",
  "Attendance & report card :: your attendance %, and download your report card (PDF).",
  "Fees, Homework & Notes :: dues, assigned homework, class material.",
]);

h2("Parent  —  stay informed");
bullets([
  "Children :: this parent has 2 children in Grade 1-A — see them all in one account.",
  "Feedback & commendations :: read teachers' feedback and 👏 commendations for each child.",
  "Rate teachers :: rate your children's teachers (anonymous).",
  "Complaints :: raise a complaint (optionally anonymous) — only the Dean sees it.",
  "Attendance, report cards & fees :: track each child and download report cards.",
]);

h2("Nice touches to point out");
bullets([
  "Light / dark mode :: toggle in the top bar.",
  "Fully responsive :: open the same URL on a phone.",
  "Secure by design :: role-based access, hashed passwords, data isolated per school.",
  "PDF exports :: report cards and payslips export to print-ready PDFs.",
]);

// ── Updates ──────────────────────────────────────────────────────────────────
doc.addPage();
band("Updates", "Change log");

h2("16 June 2026 — latest");
para("Phone-first redesign & filters — the whole app was rebuilt phone-first; it's now genuinely pleasant to use on a phone, while staying clean on desktop.");
bullets([
  "Mobile navigation :: a bottom tab bar with a \"More\" drawer, bottom-sheet dialogs and larger touch targets.",
  "Tables become cards on phones :: each row is a tidy, labelled card instead of a squashed, side-scrolling table.",
  "Redesigned home for every role :: a compact, even tile grid of the numbers that matter, a swipeable quick-action rail, and at-a-glance charts (fees, enrolment, ratings) drawn natively — no heavy chart library.",
  "Less endless scrolling :: Teacher Performance and Staff Attendance now have their own pages; the dashboard shows a short preview + \"View all\".",
  "Filters on the big lists :: Students (search + section + status), Teachers & Staff (search + type + status), Users (search + role + status), Expenses (status + category), Complaints (status). Searches are instant and case-insensitive.",
]);
para("Exams & teaching assignments:");
bullets([
  "Exams :: each exam now has a start–end date range, and every subject has its own date within it (a datesheet).",
  "Teaching assignments :: Admins/Deans can add subjects, and assign one teacher to all subjects of a class (for primary grades).",
]);
para("Security & data protection:");
bullets([
  "Secure sign-in :: the login session lives in a protected (httpOnly) cookie that scripts can't read, with short-lived access + auto-renewing sessions, so a stolen session can't be reused.",
  "Brute-force protection :: repeated wrong-password attempts are throttled.",
  "Activity log :: an append-only record of sensitive actions (logins, approvals, payments, grade entry, record changes) — who did what and when — for the Admin to review.",
  "Per-school isolation :: every school's data lives in its own database; passwords are strongly hashed; access is strictly role-based.",
]);

h2("Earlier — June 2026");
bullets([
  "Staff attendance :: geofenced \"On Campus\" check-in (phone GPS) + an academic calendar that sets working days, the Saturday rule and holidays.",
  "Dean dashboard :: live financial overview (fees pending, staff payments pending, salary paid to date, total expenditure) and enrolment (new admissions vs students who left this session).",
  "Expense approvals :: fixed expense categories; claims route to the Dean to approve, the accountant marks them paid.",
  "Full & Final settlement :: compute and approve a leaving staff member's final dues (pending salary + bonus − deductions).",
  "Teaching assignments :: assign a teacher to each subject in each section.",
  "Teacher ratings :: students & parents rate their teachers (anonymous, 1–5★); teachers see their average, the Dean sees a performance view.",
  "Feedback & commendations :: staff post feedback or positive commendations on a student; the student and parents see them.",
  "Complaints :: students, teachers and parents can report a staff member (optionally fully anonymous) — only the Dean sees and resolves them.",
  "Parents & students :: one parent account now shows all of their children; leave is simplified to Casual / Sick.",
]);

// ── How to use the new features (step by step) ───────────────────────────────
doc.addPage();
band("Using the New Features", "Step by step");
para("Every login below uses the password Demo@1234. Switch roles by logging out and back in.");
steps([
  "Set teaching assignments — Admin / Dean :: Sidebar → Teaching Assignments → pick a class-section → assign a teacher to each subject. Add subjects right there if needed, or use \"One teacher for all subjects\" for primary classes. This defines which teachers a student can rate.",
  "Rate teachers — Student & Parent :: Sidebar → Feedback → \"Rate your teachers\" → click 1–5 stars + an optional comment → Save. Ratings are anonymous.",
  "See ratings — Teacher & Dean :: Teacher: Dashboard → \"My rating\" (your average). Dean: Dashboard → \"Teacher performance\" — every teacher ranked, with comments.",
  "Give feedback or a commendation — any staff :: Sidebar → Overview → Students → open a student → \"Feedback & commendations\" → choose Feedback or Commendation, a category and a message → Add.",
  "Read feedback — Student & Parent :: Sidebar → Feedback → \"Feedback & commendations\" (the 👏 badge marks a commendation).",
  "File / resolve a complaint :: Student / Teacher / Parent: Sidebar → Complaints → pick a staff member, category, message, tick Anonymous if you wish → Submit. Dean: Complaints → open one → Mark resolved.",
  "Staff attendance & calendar :: Admin: School Setup → set the campus location (map) + academic calendar. Staff: Dashboard → \"On Campus\" check-in — works only inside the geofence (use a phone for real GPS).",
  "Dean dashboards & settlements :: Dean: Dashboard shows the Financial overview + Enrolment. Admin/Dean: Settlements → create → approve; the Accountant marks it paid.",
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
