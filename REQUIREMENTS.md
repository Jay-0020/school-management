# School Management Portal — Requirements

> Multi-school SaaS sold as an **isolated per-school deployment**. One template
> codebase, white-labeled per buyer. Market: **India**. **Web-first** (responsive).
> Stack: **Express API + React SPA + PostgreSQL**.

---

## 1. Product / reseller model

Each school runs its **own instance** (own app + own DB). This only stays sellable
if the code never forks — so these are hard requirements:

- **Single source repo** → builds a Docker image. New school = new instance from the *same* image.
- **All branding is config:** school name, logo, favicon, color theme, domain, contact
  info, login art — from per-instance config (`.env` + a `school_settings` table). Never hardcoded.
- **All India payroll / fee / grading rules are config**, tunable per school without a code change.
- **One-command provisioning:** app + DB + seed admin + branding for a new school in minutes (script/CI).
- **Central version tracking:** know which school runs which build.

---

## 2. User roles (RBAC)

| Role | Capabilities |
|---|---|
| **Super Admin** (JS-services) | Provision instances, branding, releases — outside the school's data |
| **School Admin / Principal** | Full school config, staff & student records, fees, payroll, final approvals |
| **Accountant / Finance** | Fees, payroll processing, expense payouts, financial reports |
| **Teacher** | Attendance, classwork/homework, exam marks, notes, expense requests |
| **Student** | View work, marks, attendance, fees due; upload & share notes |
| **Parent** (optional, recommended) | View child's attendance/marks/fees, pay fees, notices |

Requirement: role-based access control with per-module permissions + row-level scoping
to the correct class/section.

---

## 3. Functional requirements by module

### 3.1 Auth & accounts
- Email/phone + password login; password reset; OTP (phone) for parents/students.
- Per-role dashboards on login; session management; forced password change on first login.
- Audit log of sensitive actions (payroll run, expense approval, record edits).

### 3.2 School setup (admin)
- Academic year, classes → sections, subjects, terms/exams.
- Branding/theme config (white-label panel).
- Staff & student bulk import (CSV/Excel).

### 3.3 Students data
- Profile: admission no., personal/contact, guardian info, class/section, photo, documents,
  medical notes.
- Enrollment history, promote/transfer between classes, alumni/inactive status.

### 3.4 Teachers & staff data
- Profile, qualifications, subjects taught, assigned classes, joining date, salary-structure
  link, documents.
- Teaching vs non-teaching staff distinction (for payroll).

### 3.5 Attendance
- Daily / period-wise student attendance (teacher marks per class/section).
- Staff attendance (feeds payroll — leaves, loss of pay).
- Leave management: apply → approve workflow; leave balances.
- Reports: % attendance per student/class/month; absentee alerts to parents.

### 3.6 Notes sharing (students)
- Students upload notes (PDF/images/docs) tagged by subject/class/topic.
- Shared within class/section (optionally school-wide); teacher moderation (approve/remove).
- Download, search, report-inappropriate; storage quota per file/user.

### 3.7 Schoolwork (teachers)
- Homework/assignments with due dates and attachments.
- Timetable management (class & teacher views).
- Exams: create, enter marks, configurable grading scale, report cards/marksheets (PDF).
- Notices/announcements (school-wide, class, or role-targeted).

### 3.8 Fees (India — recommended for v1)
- Fee structures per class (tuition, transport, exam, misc), installments / term-wise.
- Invoice generation, due dates, late-fee rules, discounts/scholarships.
- Online payment (Razorpay/PayU/Cashfree) + manual/cash entry.
- Receipts (PDF), outstanding-dues reports, reminders to parents.

### 3.9 Payroll (India)
- Salary structure: Basic, HRA, DA, conveyance, special allowances.
- Statutory deductions: **PF (EPF), ESI, Professional Tax (state-wise), TDS.**
- Attendance/leave-driven (LOP), monthly payroll run, **payslip PDF**, salary register.
- Bank-transfer export (NEFT advice file). Form-16 / annual summaries → later phase.

### 3.10 Expense management & approval
- Submit expense: category, amount, description, **receipt upload**.
- **Configurable approval workflow** (e.g. Teacher → Dept Head → Principal → Finance) with
  amount thresholds (small auto-approve, large needs principal).
- States: submitted → approved/rejected → paid/reimbursed; comments at each step.
- Budget categories & spend reports.

### 3.11 Notifications
- In-app + email; SMS/WhatsApp for India (fee due, absence, notices) via MSG91/Gupshup — config per school.

### 3.12 Dashboards & reports
- Role dashboards (admin: attendance %, fees collected, pending approvals; teacher: today's
  classes, pending grading; student/parent: dues, attendance, upcoming work).
- Exportable reports (PDF/Excel) across modules.

---

## 4. Non-functional requirements
- **Security:** RBAC, encrypted secrets, hashed passwords (bcrypt/argon2), HTTPS only,
  input validation, rate limiting, file-upload type/virus checks, signed URLs for documents.
- **Compliance (India):** DPDP Act 2023 — minors' data needs verifiable parental consent,
  data-retention & deletion policy, consent records. Audit trail.
- **Data isolation:** satisfied by separate DB per instance (advantage of this model).
- **Backups:** automated per-instance DB backup + restore runbook.
- **Performance:** hundreds–few thousand users/school; pagination, indexed queries, dashboard caching.
- **Availability & monitoring:** health checks, error tracking (Sentry), per-instance uptime monitor.
- **Localization-ready:** INR, Indian date format, IST; structured for future languages.

---

## 5. Technical architecture
- **Backend:** Node.js + Express (NestJS optional) REST API, JWT auth, layered routes → services → data.
- **Frontend:** React SPA (Vite), component library (MUI/Ant), React Query, role-based routing.
- **Database:** PostgreSQL + ORM (Prisma/TypeORM) with migrations.
- **File storage:** S3-compatible (AWS S3 / Cloudflare R2 / MinIO).
- **Integrations:** payment gateway, SMS/WhatsApp, email (SES/SMTP), PDF generation.
- **Packaging:** Dockerized; `.env` + `school_settings` drive all white-label config;
  provisioning script for new instances.

---

## 6. Phasing
- **MVP (Phase 1):** Auth/RBAC, school setup + branding, students, teachers/staff,
  attendance, notices, notes sharing. → demoable, sellable core.
- **Phase 2:** Fees + payments, schoolwork (homework/exams/marks/report cards), parent portal.
- **Phase 3:** Payroll (India statutory), expense approval workflow, advanced reports.
- **Phase 4:** White-label automation (one-command provisioning, super-admin console),
  SMS/WhatsApp, dashboard polish.

---

## 7. Open decisions
1. Parent portal in v1 or later?
2. Hosting target for per-school instances (VPS each / containers on one box / cloud)?
3. Custom domain per school vs subdomain?
4. Payment gateway (Razorpay is the common India default)?
5. Online fee payment in MVP, or admin records payments manually first?
