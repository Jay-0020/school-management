# Client Update Log

Tracks the changes built in response to client feedback — what was requested,
what was delivered, and **how each feature flows** end to end. Updated as each
requirement is completed.

---

## Status overview

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Staff attendance (geofenced) + academic calendar | ✅ Done |
| 2 | Expense approval → Dean + fixed categories | ✅ Done |
| 3 | Dean dashboard: student fees pending | ✅ Done |
| 4 | Dean dashboard: staff payments pending | ✅ Done |
| 5 | Dean dashboard: salary paid to date | ✅ Done |
| 6 | Full & Final settlement (Dean approval) | ✅ Done |
| 7 | Teacher performance + parent/student feedback | ✅ Done |
| 8 | Student onboarding & retention (per academic year) | ✅ Done |
| 9 | Dean dashboard: overall expenditure | ✅ Done |
| 10 | Parents & Students — one parent account, all kids | ✅ Done |
| 11 | Feedback section (students/parents) | ✅ Done |
| 12 | Leave categories → Casual / Sick only | ✅ Done |
| 13 | Teacher ratings (students + parents) | ✅ Done |
| 14 | Accountant section | ✅ No change needed |

### Additional features (requested during the build, beyond the original 14)
| Teaching assignments (teacher × subject × section) | ✅ Done |
| Teacher → student feedback (+ history) | ✅ Done |
| Commendations to parents | ✅ Done |
| Complaints about staff (anonymous optional) | ✅ Done |

---

## Update 1 — Staff geofenced attendance + academic calendar
*Completed: 15 Jun 2026*

**Requested:** Staff press an "On Campus" button to mark attendance, but only
when physically at the school; Admin sets the school location + radius. Plus an
academic calendar to define working days for the attendance %.

**Delivered:**
- **School Setup → Campus location:** a free map (OpenStreetMap, no Google
  cost) where the Admin clicks the school location and sets a radius, or taps
  "Use my current location".
- **School Setup → Academic calendar:** session start/end dates, a Saturday
  rule (all working / all off / 2nd & 4th off), Sundays always holidays, and
  click-any-day to mark a holiday with a notice. The Dean can also access
  School Setup.
- **Staff check-in:** an "On Campus" button that only works inside the radius
  (re-checked on the server), one tap = present for the day.
- **Attendance %** = days present ÷ working days (approved leave still counts
  against it).
- A **read-only calendar** on every role's dashboard, and a **staff-attendance
  overview** for Dean/Admin.
- A holiday's notice **auto-appears on the notice board the day before** and
  disappears afterwards.

**How it flows:**
1. Admin opens **School Setup**, pins the school on the map, sets the radius,
   and saves; then sets the session dates + Saturday rule and marks any
   holidays on the calendar.
2. A staff member opens their dashboard; the app reads their phone's location.
3. If they're inside the radius, the **"On Campus — Check in"** button appears;
   one tap records their attendance for the day.
4. Their **attendance %** updates against the calendar's working days.
5. The **Dean** sees every staff member's % in the dashboard overview; everyone
   sees the read-only calendar.

**Who/where:** Admin + Dean (School Setup); all staff (check-in); Dean + Admin
(staff-attendance overview); everyone (read-only calendar).

---

## Update 2 — Expense approval → Dean + fixed categories
*Completed: 15 Jun 2026*

**Requested:** When staff submit an expense it should go to management for
approval, with a fixed set of expense types; the Dean approves.

**Delivered:**
- **Fixed categories:** Travel · Student activity · Professional development ·
  Technology & equipment · Communication · Miscellaneous office (a dropdown,
  enforced on the server).
- **Dean + Admin approve / reject**; **Accountant + Admin mark paid** (the Dean
  can approve but not mark paid).
- The **Dean** sees all expenses + the totals summary.
- **Notifications:** the Dean is alerted when an expense is submitted; the
  submitter is alerted when it's approved or rejected.

**How it flows:**
1. A staff member opens **Expenses → Submit expense**, picks a category, enters
   the amount + description, and submits.
2. The **Dean** (and Admins) get a notification and see it under Expenses; they
   **Approve** or **Reject** with an optional note.
3. The **submitter** is notified of the decision.
4. Once approved, the **Accountant** (or Admin) opens it and **Marks paid**.

**Who/where:** all staff (submit); Dean + Admin (approve/reject); Accountant +
Admin (mark paid).

---

## Update 3 — Dean financial overview (fees, payroll, salary, expenditure)
*Completed: 15 Jun 2026 — covers requirements #3, #4, #5, #9*

**Requested:** The Dean should see, on their dashboard, the overall fees
pending from students, how much payment is pending to staff, how much salary
has been paid to teachers so far, and the overall expenditure to date.

**Delivered:** a **Financial overview** panel on the Dean's (and Admin's)
dashboard with four live figures:
- **Student fees pending** — total outstanding across all unpaid/partial
  invoices.
- **Staff payments pending** — total of payslips that are generated but not
  yet paid.
- **Salary paid to date** — total of payslips already paid.
- **Total expenditure** — total of expenses marked paid, plus a **breakdown by
  category**.

**How it flows:**
1. The figures are computed live from existing invoices, payslips and expenses
   — nothing extra to maintain.
2. When the Dean opens their dashboard, the **Financial overview** panel shows
   the four totals at a glance, with the expenditure split by category beneath.

**Who/where:** Dean + Admin (dashboard).

---

## Update 4 — Leave categories simplified to Casual / Sick
*Completed: 15 Jun 2026 — requirement #12*

**Requested:** Leave requests should only be **Casual** or **Sick** (the earlier
Earned and Unpaid options are removed).

**Delivered:**
- The leave form now offers just **Casual** and **Sick**.
- The Earned-leave quota has been removed everywhere (staff quotas are now
  Casual + Sick only).
- Any historical Earned/Unpaid requests were safely re-labelled (Earned →
  Casual, Unpaid → Sick) so nothing was lost.

**How it flows:**
1. A staff member raises a leave request and picks **Casual** or **Sick**.
2. Advance requests are still checked against that category's annual quota.

**Who/where:** all staff (leave form); Admin (per-user leave quotas under Users).

---

## Update 5 — Student onboarding & retention + filterable people view
*Completed: 15 Jun 2026 — requirement #8 (+ a Dean people-filter enhancement)*

**Requested:** The Dean should see how many new students joined during a
session and how many left; and (from follow-up) be able to browse all
students/staff and filter by grade & section.

**Delivered:**
- Each student now has an **admission date** (when they joined) and, if they
  leave, a **leaving date** — recorded via a **"Mark as left"** action that
  also captures the reason (Transferred / Graduated / Withdrawn).
- A Dean/Admin dashboard widget **"Enrolment this session"**:
  **new admissions**, **students left**, **currently active**, **net change**,
  plus a **departures-by-reason** breakdown. Counts use the session dates set
  in School Setup.
- The **People Overview** now has **Grade + Section** filters for students and
  a **Teaching / Non-teaching** filter for staff, alongside the search box.

**How it flows:**
1. When a student is admitted, their admission date is recorded (today by
   default; editable).
2. When a student leaves, an admin opens the student, sets the status
   (Transferred/Graduated/Withdrawn) → the leaving date is recorded and they go
   inactive.
3. The **Dean** sees, on their dashboard, how many joined vs left this session
   and the net change; and can filter the People Overview by grade/section.

**Who/where:** Dean + Admin (enrolment widget + filters); Admin (mark students
left / set admission dates).

---

## Update 6 — Parent ↔ children linking (no merge)
*Completed: 15 Jun 2026 — requirement #10*

**Decision:** The original idea was to *merge* student and parent into one
profile. On review we **did not** do that — a parent with two children would
then need two logins. Instead we kept **parents as their own account that shows
all of their children in one place** (which the system already supports via a
"My Children" view).

**Delivered:**
- A **Parent account** picker in the student editor — assign an existing parent
  to a student (or leave unlinked). Point several students at the same parent
  and that one parent account sees them all.
- The **Students list** now shows each student's **linked parent**.
- Confirmed: linking a second child to a parent makes both appear under that
  parent's **My Children** automatically.

**How it flows:**
1. Admin opens a student, picks the **Parent account** (shows the parent's
   email + the children already linked), saves.
2. The parent logs into their single account and sees **every** linked child's
   attendance, report cards and fees from the "My Children" page.

**Who/where:** Admin (link parents in the student editor / Students list);
Parent (one account → all children).

---

## Update 7 — Full & Final settlement
*Completed: 15 Jun 2026 — requirement #6*

**Requested:** When a staff member leaves, the Dean should see and approve their
full-and-final settlement, with a total and a breakdown.

**Delivered:** a new **Settlements** page (Finance) where:
- An **Admin or Dean** creates a settlement for a staff member — the system
  auto-fills **pending salary** (their unpaid payslips); they add a
  **gratuity/bonus** and any **deductions** + a last working day and notes.
- The **breakdown** is shown live: *Pending salary + Bonus − Deductions = Net
  payable*.
- The **Dean (or Admin) approves or rejects**; approving marks the staff member
  as having **left** (inactive).
- The **Accountant (or Admin)** then **marks it paid**.

**How it flows:**
1. Admin/Dean → Settlements → New settlement → pick the staff member (their
   pending salary appears) → enter bonus/deductions → create (status Pending).
2. Dean reviews the breakdown and **Approves** → the staff member goes inactive.
3. Accountant **marks it paid**.

**Who/where:** Admin + Dean (create, approve/reject); Accountant + Admin (mark
paid); all three can view the Settlements page.

---

## Update 8 — Teaching assignments, ratings, feedback, commendations & complaints
*Completed: 16 Jun 2026 — requirements #7, #11, #13 (+ teacher→student feedback,
commendations and complaints, added during the build)*

This was built as one connected block.

**Teaching assignments (foundation):** since a class has many teachers, an
**Admin/Dean** now assigns a teacher to each **subject** in each **section**
(a "Teaching Assignments" screen). This defines a student's set of teachers.

**Teacher ratings (#13, #7):** students and parents give each of their section's
teachers a **1–5★ rating + optional comment**. Ratings are **anonymous** — the
teacher sees only their **average** (on their dashboard); the **Dean/Admin** see
a **Teacher Performance** view (everyone ranked, with comments).

**Teacher → student feedback:** any staff member can record **feedback** about a
student (category + message); the teacher sees that student's **history**, and
the **student + parent** see it.

**Commendations:** staff can post a positive **commendation** ("doing great at
…") — the **parent** is notified and sees it in their **Feedback** area
(students see it too).

**Complaints (#11 area):** students, teachers and parents can **file a complaint
about a staff member**, optionally **fully anonymous** (no identity stored).
**Only the Dean** (and Super-Admin) see and resolve them (Open → Resolved).

**How it flows:**
1. Admin/Dean set up **Teaching Assignments** (teacher per subject per section).
2. Students/parents open **Feedback** → rate their teachers and read feedback &
   commendations about themselves/their children.
3. Staff open a student (People Overview) → add **feedback or a commendation**
   and see the student's history.
4. Teachers see their **average rating**; the Dean sees **Teacher Performance**.
5. Anyone can file a **Complaint** (optionally anonymous); the **Dean** reviews
   and resolves it.

**Who/where:** Admin+Dean (assignments, performance); students/parents (rate +
read feedback); any staff (post feedback/commendations); Dean+Super-Admin
(complaints).

---

🎉 **All 14 of the client's original requirements are now complete**, plus the
extra feedback/commendation/complaint features requested along the way.

**Live demo refreshed (16 Jun 2026):** all the new modules are deployed and
populated on the live demo — https://school-demo-nnfb.onrender.com — with
sample teaching assignments, ratings, feedback, a commendation and a complaint.
Logins (all `Demo@1234`): superadmin@ / admin@ / dean@ / accountant@ / teacher@
/ student@ / parent@greenwood.demo. The demo-guide PDF is updated to match.
