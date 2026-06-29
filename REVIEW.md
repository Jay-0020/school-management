# Codebase Review — School Management SaaS (2026-06-29)

Full A–Z review by 7 parallel review agents reading the actual code (not docs/memory).
Scope: multi-tenancy isolation, security/auth, RBAC/IDOR, backend correctness & money
logic, Prisma schema, frontend, production-readiness. ~5,900 LOC backend, ~9,950 LOC
frontend, 753-line Prisma schema, **0 automated tests**.

---

## 🧭 BLOCKER MATRIX — known vs new, doable-now vs blocked-on-infra

Cross-referenced against the repo docs (GOING-LIVE.md, RAZORPAY_SETUP.md, REQUIREMENTS.md,
CLIENT_UPDATES.md, ONBOARDING.md, TEST_CASES.md + the 2 client PDFs).

**Headline:** the docs already know the *infra/deploy* gaps. **Every money, correctness, and
security bug below is NEW — documented nowhere.** "DOABLE NOW" = pure code, needs no server /
client / domain / payment account. "BLOCKED" = needs external infra or a client decision.

| ID | Blocker | Known? (source) | Doable now? |
|----|---------|-----------------|-------------|
| **A1** | Managed-PG SSL missing from Prisma URLs | **KNOWN** — GOING-LIVE 167-168 (flagged *uncertain*, "one-line tweak") | ✅ **NOW** (code; full test needs managed PG) |
| **A2** | `tenants.json` bind-mount breaks on fresh clone | **PARTIAL** — ephemeral-disk noted (GOING-LIVE 364-369); fresh-clone bootstrap NOT | ✅ **NOW** (compose + touch empty registry) |
| **A3** | No `unhandledRejection`/`uncaughtException` → all schools crash | 🆕 **NEW** — undocumented | ✅ **NOW** (pure code) |
| **B1** | Payment recording not atomic → double-credit | 🆕 **NEW** | ✅ **NOW** |
| **B2** | No overpay clamp → negative balance | 🆕 **NEW** | ✅ **NOW** |
| **B3** | Settlement doesn't mark payslips PAID → salary paid twice | 🆕 **NEW** | ✅ **NOW** |
| **B4** | Leave quota bypassable | 🆕 **NEW** | ✅ **NOW** |
| **B5** | Attendance "today" keyed UTC not IST | 🆕 **NEW** | ✅ **NOW** |
| **C1** | `Secure` cookie keys off NODE_ENV not TLS | 🆕 **NEW** | ✅ **NOW** |
| **C2** | `mustChangePassword` advisory-only (API bypass) | 🆕 **NEW** (TEST_CASES TC-03 notes "no forced change" as a demo deviation, not a bug) | ✅ **NOW** |
| **C3** | Password change doesn't revoke sessions | **KNOWN** as backlog — CLIENT_UPDATES Update 13 ("foundation for force-logout-everywhere") | ✅ **NOW** |
| **D1** | Razorpay keys GLOBAL not per-tenant | **KNOWN** — GOING-LIVE 461-476, RAZORPAY_SETUP 10-18 (fix prescribed) | ⚠️ code **NOW**; live test BLOCKED (per-school Razorpay accounts + KYC) — *mitigation today: leave RAZORPAY_* unset = online pay off* |
| **D2** | Notes uploads NOT per-tenant (cross-school read/delete) | 🆕 **NEW** — undocumented (docs only say "back up uploads") | ✅ **NOW** |

### Pure-infra / client items (from docs — NOT code bugs, listed so the picture is complete)
| Item | Status | Blocked on |
|------|--------|-----------|
| Prod server + DO Managed PG + per-school domains + TLS | decided (Option B, Bangalore) | client buys infra |
| Per-school Razorpay account + KYC (live payments) | pending | each school's KYC |
| Caddyfile, self-host compose, backup-uploads cron | not written ("ask me to generate") | ✅ writable NOW; runnable only on the server |
| CI/CD pipeline + wire `migrate:all` into deploy | proposed only | ✅ workflow writable NOW; deploy target needs server/GHCR |
| Registry → control-plane DB table (removes restart-to-add-school) | future | scale / client decision |
| SMS/WhatsApp + phone-OTP login, DPDP minor-consent, S3, Sentry | spec'd, deferred | accounts / legal / scale decisions |
| Online-fee fee-bearer (parent vs school) + gateway choice | open | client preference |

### What I'd actually do RIGHT NOW (no infra needed), in order
1. **Test harness** (Vitest + Supertest on throwaway Postgres) — port the highest-value TEST_CASES.md cases so the fixes below are regression-proof.
2. **Money/correctness (B1–B5)** + the exam-logic HIGHs — biggest real-harm, all pure code.
3. **Security (C1–C3)** + **crash-safety (A3)** — go-live safety, pure code.
4. **Tenant isolation (D2 notes uploads; D1 Razorpay per-tenant code)** — before school #2.
5. **A1 SSL one-liner + A2 registry bootstrap** — code now, verify when the DO box exists.
6. **Authz HIGHs** (teacher section/marks scoping), missing **indexes**, **AuditLog prune**.
7. **Write (don't run) the infra files** — Caddyfile, self-host compose, backup cron, CI workflow — staged for when the server lands.

PARKED until infra/client: live Razorpay (accounts+KYC), actual server deploy, SMS/OTP/DPDP/S3/Sentry, registry-as-DB-table.

---

## Overall verdict
Genuinely well-built: clean architecture, fully parameterized Prisma (no SQLi), argon2,
per-tenant JWT, HMAC-verified Razorpay with server-trusted amounts, sane RBAC, no XSS,
solid auth-refresh flow, correct payroll math. The multi-tenant core (Prisma-proxy +
AsyncLocalStorage) is **sound and fail-closed**. NOT yet safe to onboard a real (or a
second) paying school — cluster of blockers around money atomicity, payment/file tenant
isolation, and prod config. All targeted fixes, no rewrite. Biggest structural risk:
**zero automated tests**.

---

## 🔴 BLOCKERS (raw — annotation matrix added separately)

### Group A — Blocks the first real deployment
- **A1. Managed-Postgres SSL missing from Prisma URLs.** `psql` honors `PGSSLMODE` but Prisma needs `sslmode=require` IN the URL. `provision.mjs:71-72` builds `dbUrl` with only `?schema=public`; `:130` migrate, `:132` seed, `:141` tenants.json `databaseUrl`, `migrate-all-tenants.mjs:55`, runtime `src/lib/prisma.ts:16` all lack it → first provision against DO Managed PG fails.
- **A2. `tenants.json` bind-mount + gitignored** (`docker-compose.app.yml:32`). Fresh clone has no file → Docker mounts it as a directory → registry parse fails. Mount the directory or pre-create `{"tenants":[]}`.
- **A3. No crash handler** (`src/index.ts`). No `unhandledRejection`/`uncaughtException` → one bad request crashes the single process = all schools down.

### Group B — Money / data corruption (single school)
- **B1. Payment recording not atomic** (`fees.routes.ts:267-286`). Read-check-write, no transaction/row-lock → concurrent payments double-credit/overpay.
- **B2. No overpay clamp** (`online.ts:43-57` `recomputeInvoice`). `amountPaid` can exceed total → negative balance on receipts/dashboard.
- **B3. Settlement payout never marks payslips PAID** (`settlements.routes.ts:24-30,93-94,158-165`). Same salary payable twice (F&F + payroll `/payslips/:id/pay`).
- **B4. Leave quota bypassable** (`leave.routes.ts:135-145` apply, `259-268` approve, `37-49` usedDays). Counts only APPROVED, no check at approval, TOCTOU race; JUSTIFICATION never consumes quota.
- **B5. Attendance "today" keyed to UTC not IST** (`staff-attendance.routes.ts:49,65,92` via `lib/calendar.ts utcMidnight`; student `attendance.routes.ts parseDay` uses a different day def). 00:00–05:30 IST → previous day; modules disagree.

### Group C — Security must-fix before real users
- **C1. `Secure` cookie keyed off `NODE_ENV` not TLS** (`auth.routes.ts:23-26`, `env.ts:51`). Misconfigured prod → plaintext session cookies. Derive from `req.secure` (trust proxy is set, `app.ts:43`).
- **C2. `mustChangePassword` advisory only** (`auth.routes.ts:84,116`; `users.routes.ts:122,165`; no gate in `auth.ts`; FE `ProtectedRoute.tsx:11-20` doesn't check). Temp/seed password usable via API indefinitely.
- **C3. Password change doesn't revoke sessions/refresh tokens** (`auth.routes.ts:163-185`, `users.routes.ts:165`). Compromised session survives up to 7 days. (= the "force-logout-everywhere" backlog item.)

### Group D — Blocks the second school (tenant isolation)
- **D1. Razorpay credentials global, not per-tenant** (`online.ts:11-13,24-33,99,111,146`; `env.ts:34-36`; `tenants.ts:25-31` has no Razorpay fields). All schools' payments → the one env account; webhook settles against wrong tenant (resolves tenant by callback Host). MITIGATION: leave `RAZORPAY_*` unset so online pay stays disabled until per-tenant.
- **D2. Notes uploads not per-tenant** (`notes.routes.ts:14,30-31,141,180`). Shared `uploads/notes`; a note row in School A can read/`unlink` School B's file. Mirror `photos.ts` (per-tenant dir + `basename()` guard).

---

## 🟠 HIGH (privilege / wrong results)

### Authorization (RBAC/IDOR)
- **Teacher can mark attendance for ANY section** (`attendance.routes.ts:24-26,60,69,84-89`) — `requireRole(STAFF)` only; no class-teacher/assignment check; bulk `update` overwrites `sectionId`; `studentId` trusted.
- **Teacher can enter marks for ANY paper** (`exams.routes.ts:173,210`) — no subject-assignment check.
- **Marks accepted for students NOT in the exam's class** (`exams.routes.ts:210-242`) — no `student.section.classId === exam.classId` check.
- **Teacher/Dean can view ANY student's report incl. unpublished DRAFT** (`exams.routes.ts:296-316` `canViewReport` returns true unconditionally; no `requireRole`).

### Exam/grade correctness
- **Report-card % over only graded subjects** (`exams.routes.ts:271-275,292`) → missing papers dropped → inflated PASS.
- **Ranking counts no-mark students as 0, no tiebreak, arbitrary order** (`exams.routes.ts:399-414`).
- **`passMarks` not validated ≤ `maxMarks`** (`exams.routes.ts:122-127,148-157`) → unpassable papers → whole report FAIL.

### Leave / attendance
- **Leave AY bucketing drops boundary-spanning leave** (`leave.routes.ts:37-49`) — filters `fromDate` only, counts full `dayCount`.
- **Staff attendance % can exceed 100%** (`staff-attendance.routes.ts:13-24,80,101-123`) — holiday/weekend check-ins counted, never clamped.

### Frontend correctness
- **AttendancePage save invalidates no caches** (`AttendancePage.tsx:121-135`) → stale summary/people/dashboard.
- **ExamsPage marks entry**: no per-cell validation (one bad cell rejects whole batch), `setMarks` as queryFn side-effect → background refetch clobbers edits, no invalidation (`ExamsPage.tsx`).
- **FeesPage shows client-recomputed online total** (`FeesPage.tsx:454,629`) vs backend `order.amount`; pay button re-enables in `finally` → possible double order (`:489-499`).
- **PeoplePage loads all ~600 students unpaginated** (`PeoplePage.tsx:23,139-159`), each row a separate `<img>`; search undebounced.

### Security
- **No CSRF defense** on cookie-auth state-changing endpoints (`auth.ts:38-49`, `app.ts:64-78`); login CSRF.
- **Refresh-token reuse not detected** (`auth.routes.ts:90-120`) — revoked-token replay just 401s, doesn't kill the family.
- **Login user-enumeration via timing** (`auth.routes.ts:55-59`) — argon2 only runs when user exists.

---

## 🟡 MEDIUM

### Schema / perf (add indexes)
- `Notification(userId, createdAt)` (highest-frequency sort), `Teacher(isActive)`, `Teacher(staffType)`, `Payslip(status)`, `LeaveRequest(applicantId, status, fromDate)`, `Student(admissionDate)`.
- Remove redundant `@@index([date])` on `Holiday`.
- **AuditLog has no retention/prune job** — the only real growth cliff.
- `pg_trgm` GIN indexes for `contains` text searches — future, when search slows (raw-SQL migration).

### Frontend robustness
- **Systemic React Query staleness**: mutations don't invalidate cross-page keys — paying fee ↛ parent "fees due"; publish exam ↛ report cards; notice ↛ dashboard; homework ↛ parent overview; setup ↛ dashboard KPIs; leave cancel ↛ balance; payslip pay ↛ detail; settlement filter-while-open → crash (`data!.find!`).
- **Silent mutation failures (no `onError`)**: UsersPage toggle/del/reset, feedback add, complaints resolve, feedback save, leave cancel, setup saves, several deletes, attendance save.
- **Missing `isError` states**: most lists; `StaffCheckIn`/`RatingWidgets` `return null` on load/error → blank pages.
- **Form validation drift vs zod**: fractional/negative/over-balance amounts (Expenses, Fees payment, Settlements), Notice SECTION needs sectionId, Leave no `toDate>=fromDate`.

### Security / ops
- Fee invoice **list** open to TEACHER/DEAN (`fees.routes.ts:119` no `requireRole`).
- Upload MIME trusts client (`notes.routes.ts:34-35`); no magic-byte sniff (download forces `attachment` — good).
- Rate-limit only on login; nothing on change-password (argon2 oracle/DoS), online-verify, uploads; in-memory (won't share across workers).
- **No log persistence** (morgan→stdout, lost on restart); no error tracking.
- **No uploads backup script** (photos/notes die with the droplet; DB is on managed PG).
- **CI runs zero tests**; never verifies a clean `migrate deploy` on a fresh DB.

### Backend edge cases
- Leave: ADVANCE backdatable / JUSTIFICATION future-datable (`leave.routes.ts:112-145`); auto-EXCUSED marks weekends+holidays (`:286-309`); no max-span guard (DoS); AY boundary uses UTC.
- Holiday match assumes exact UTC-midnight (`staff-attendance.routes.ts:17`) → IST holiday never matches.
- Bulk attendance doesn't dedupe studentIds; reports inflated `saved` count.
- Exam per-subject % lacks zero-guard for legacy `maxMarks:0`.
- Deleting PUBLISHED exam/paper cascade-wipes marks, no block/audit.

---

## 🟢 LOW / polish
- Accessibility: clickable rows/modals/charts lack ARIA + keyboard; `window.prompt`/`confirm` for reject-reason and destructive deletes (paper/subject delete has NO confirm).
- Duplicated `(err as {response...})` cast in ~8 files → extract `getApiError()`.
- `jwtSecret` min length only 8 (want ≥32).
- Fees `CANCELLED` status is dead code (no cancel endpoint).
- Empty marks cell shows `0` not `null`; array-index React keys; dead `Exam.examDate` field.
- CSP `img-src https:` broad (justified for logos/OSM tiles).

---

## ✅ Confirmed solid (don't touch)
- Tenant data isolation: Prisma proxy + AsyncLocalStorage, `requireTenant()` throws on no-context (fail-closed); no detached callbacks (no setTimeout/EventEmitter in src); per-tenant JWT verified bidirectionally (School A token = 401 on School B).
- Razorpay settlement idempotency (`settleOrder` in `$transaction`, double-checks status), raw-body HMAC webhook, server-trusted amounts, order↔invoice binding.
- Payroll `computePayslip` matches spec exactly (PF round(12% of min(basic,15000)), ESI ceil(0.75% of gross) when gross≤21000, PT/TDS from structure); payslip dedupe via `@@unique`.
- Expense + settlement state machines (can't skip/repeat states).
- Bulk student-attendance write is transactional; LATE-counts-as-attended summary with divide-by-zero guard; server-side geofence haversine.
- Auth: argon2, rotating DB-backed revocable refresh tokens, single shared in-flight refresh (dedupes concurrent 401s, `_retried` guard prevents loops), refresh re-checks `isActive`.
- Money-as-integer correct end-to-end (no erroneous /100 or *100); no XSS (no `dangerouslySetInnerHTML`); no raw SQL; CBSE grade bands contiguous; pagination caps bound result sizes.
- Photos are correctly per-tenant (`uploads/<safeDb>/photos`, sanitized, basename guard) — the model notes should follow.

---

## Cross-cutting recommendation
Add a **test harness early** (Vitest + Supertest against a throwaway Postgres) before fixing —
the money/auth/tenant fixes below are unguarded against regression with 0 tests today.
`TEST_CASES.md` already exists (manual cases) and is a ready source to automate.
