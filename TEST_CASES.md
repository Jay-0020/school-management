# School Management Portal — Browser Test Plan

**Instructions for the testing agent:** You are testing a live web app. Work
through every test case below **in order**. For each one, perform the steps,
check the **Expected** result, and record **PASS / FAIL / N-A** with a one-line
note. At the very end, output a **summary table** (ID · result · note) and a
count of pass/fail. Do not stop on a failure — continue and report it.

## Environment
- **URL:** https://school-demo-nnfb.onrender.com
- **First load may take 30–60 seconds** (the demo server wakes from sleep) — wait, don't fail.
- **All logins use password:** `Demo@1234`
- **Switch roles** by logging out (top-right user menu) and logging back in.

| Role | Email |
|---|---|
| Super Admin | superadmin@greenwood.demo |
| Admin | admin@greenwood.demo |
| Dean | dean@greenwood.demo |
| Accountant | accountant@greenwood.demo |
| Teacher (class teacher, Grade 1-A) | teacher@greenwood.demo |
| Student (Pooja Bose, Grade 1-A) | student@greenwood.demo |
| Parent (children: Pooja Bose, Diya Pillai) | parent@greenwood.demo |

## Notes before you start
- Several tests **change data** (approvals, ratings, complaints, marking a
  student left, etc.). That is **expected** on this demo.
- Tests changing the same record may interact — follow the order given.
- A "first sign-in password change" prompt should **not** appear (these accounts
  are pre-set); if it does, note it.

---

## A. Authentication
- **TC-01 — Login (valid):** Go to the URL → log in as `admin@greenwood.demo`.
  **Expected:** lands on a Dashboard showing the school name ("Greenwood High School").
- **TC-02 — Login (invalid):** Log out → try `admin@greenwood.demo` with password `wrong`.
  **Expected:** an error message; not logged in.
- **TC-03 — Logout:** From a logged-in session, use the top-right menu to log out.
  **Expected:** returns to the login screen.

## B. Role dashboards
- **TC-04 — Admin dashboard:** Login as Admin.
  **Expected:** headline stats (students, staff, fees, etc.) + Financial overview + Enrolment + Teacher-performance + a read-only calendar.
- **TC-05 — Dean dashboard:** Login as Dean.
  **Expected:** "Financial overview" (fees pending, staff payments pending, salary paid, total expenditure), "Enrolment this session", "Teacher performance", and an academic calendar.
- **TC-06 — Teacher dashboard:** Login as Teacher.
  **Expected:** a "My attendance" / On-Campus card and a "My rating" card.
- **TC-07 — Student dashboard:** Login as Student.
  **Expected:** student-relevant stats (fees due, homework) and the calendar; no staff/admin sections.

## C. School Setup — location & calendar (Admin)
- **TC-08 — Map loads:** Admin → sidebar **School Setup** → "Campus location" panel.
  **Expected:** an OpenStreetMap map renders with a marker + a radius circle (no broken-image/CSP errors in console).
- **TC-09 — Recenter on edit:** Change the **Radius** number, then click **Use my current location**.
  **Expected:** the pin moves and the **map recenters** so the pin stays centered.
- **TC-10 — Academic calendar:** "Academic calendar" panel → set a **Session start** and **end**, pick a **Saturday rule**, click **Save calendar**; then click a weekday in the grid and mark it a holiday with a note.
  **Expected:** Sundays are green/locked; the marked day turns green; "Working days" count shown.

## D. Staff attendance
- **TC-11 — On-Campus check-in (EXPECTED N-A):** Teacher → Dashboard → "My attendance" card.
  **Expected:** since the agent is **not physically at the school**, it should show **"Not on campus (… m away)"** and the check-in button should be disabled. Record **N-A** (this needs a real phone on site). If it lets you check in, note it.

## E. Students & Parents (Admin)
- **TC-12 — Students list + filters:** Admin → **Students** → filter by **Grade 1 / Section A**.
  **Expected:** the list filters to Grade 1-A students (incl. Pooja Bose, Diya Pillai).
- **TC-13 — Linked parent shown:** In the Students list, find Pooja Bose.
  **Expected:** a "Parent account" column shows `parent@greenwood.demo`.
- **TC-14 — Mark a student left:** Open any **Grade 5** student → set Status to **Transferred** (or Graduated/Withdrawn) → save.
  **Expected:** saved; status shows the new value. (Dean's Enrolment "students left" should later reflect this.)
- **TC-15 — Parent sees all children:** Login as Parent → **My Children**.
  **Expected:** both Pooja Bose and Diya Pillai are listed; selecting each shows attendance / fees / report card.

## F. Teaching Assignments (Admin / Dean)
- **TC-16 — Assign a teacher:** Admin → **Teaching Assignments** → pick **Grade 1 · A** → set a teacher for any subject.
  **Expected:** the dropdown saves; reloading keeps the selection.
- **TC-17 — One teacher for all:** Pick a section → use **"One teacher for all subjects"** → choose a teacher → **Apply to all**.
  **Expected:** every subject row now shows that teacher.
- **TC-18 — Add a subject:** On the same screen, type a new subject (e.g., "Civics") → **+ Add subject**.
  **Expected:** the subject appears in the list and can be assigned.

## G. Ratings & feedback
- **TC-19 — Student rates a teacher:** Login as Student → **Feedback** → "Rate your teachers" → give a teacher 4–5 stars + a comment → Save.
  **Expected:** "Saved"; the rating persists on reload.
- **TC-20 — Parent rates:** Login as Parent → **Feedback** → rate a teacher.
  **Expected:** saved.
- **TC-21 — Teacher sees rating:** Login as Teacher → Dashboard → "My rating".
  **Expected:** shows an average star value + a count (anonymous; no rater names).
- **TC-22 — Dean teacher performance:** Login as Dean → Dashboard → "Teacher performance".
  **Expected:** teachers listed with average ★ and counts, plus recent comments.
- **TC-23 — Staff posts feedback:** Login as Teacher → **Overview** → Students → open **Pooja Bose** → "Feedback & commendations" → add a **Feedback** (category + message) → Add.
  **Expected:** it appears in that student's history.
- **TC-24 — Staff posts commendation:** Same student → add a **Commendation** → Add.
  **Expected:** appears in history (👏).
- **TC-25 — Student/parent see feedback:** Login as Student (then Parent) → **Feedback** → "Feedback & commendations".
  **Expected:** the feedback + commendation from TC-23/24 are visible.

## H. Complaints
- **TC-26 — File anonymous complaint:** Login as Parent (or Student) → **Complaints** → pick a staff member, category, message, tick **Anonymous** → Submit.
  **Expected:** a confirmation; the filer cannot see a list of all complaints.
- **TC-27 — Dean reviews + resolves:** Login as Dean → **Complaints**.
  **Expected:** the complaint appears with "Filed by: Anonymous". Open it → **Mark resolved** → status becomes Resolved.

## I. Fees (Accountant)
- **TC-28 — Fees dashboard:** Login as Accountant → **Fees**.
  **Expected:** invoices with paid / partial / pending totals.
- **TC-29 — Record a payment:** Open a pending/partial invoice → record a payment (amount + method) → save.
  **Expected:** the invoice's paid amount/status updates.
- **TC-30 — Student sees fees:** Login as Student → **Fees**.
  **Expected:** own invoice(s) and amount due.

## J. Expenses (approval flow)
- **TC-31 — Teacher submits expense:** Login as Teacher → **Expenses** → Submit → pick a **category (dropdown)**, amount, description → Submit.
  **Expected:** created with status SUBMITTED.
- **TC-32 — Dean approves:** Login as Dean → **Expenses** → open the submitted one → **Approve**.
  **Expected:** status APPROVED.
- **TC-33 — Accountant marks paid:** Login as Accountant → **Expenses** → open the approved one → **Mark paid**.
  **Expected:** status PAID. (Dean cannot mark paid — note if a Dean sees that button.)

## K. Payroll & Settlements
- **TC-34 — Payslips:** Login as Accountant (or Admin) → **Payroll**.
  **Expected:** staff payslips with PF/ESI/PT/TDS deductions.
- **TC-35 — Create settlement:** Admin/Dean → **Settlements** → New → pick a staff member (pending salary auto-fills) → add bonus/deductions → Create.
  **Expected:** a PENDING settlement with Net = pending + bonus − deductions.
- **TC-36 — Approve settlement:** As Dean/Admin → open it → **Approve**.
  **Expected:** APPROVED (the staff member becomes inactive).
- **TC-37 — Pay settlement:** As Accountant → open it → **Mark paid**.
  **Expected:** PAID.

## L. Exams & report cards
- **TC-38 — Create exam with range:** Admin → **Exams** → + New exam → name, class, **Start date** + **End date** → create.
  **Expected:** appears in the list with a **Dates** column (start – end).
- **TC-39 — Add subject in range:** Open that exam → add a subject with a date **inside** the range.
  **Expected:** added, with the date in the **Date** column.
- **TC-40 — Date out of range rejected:** Try adding a subject with a date **outside** the start–end range.
  **Expected:** rejected / blocked (the picker limits it; the server refuses it).
- **TC-41 — Datesheet shows:** Open **Term 1 Examination**.
  **Expected:** subjects show per-subject dates (e.g., English 10 Dec, … Social Studies 18 Dec).
- **TC-42 — Publish + report card:** Publish an exam with marks → login as Student → view/download the report card.
  **Expected:** report card visible/downloadable as PDF.

## M. Leave
- **TC-43 — Apply leave (categories):** Login as Teacher → **Leave** → apply.
  **Expected:** category options are **only Casual and Sick** (no Earned/Unpaid).
- **TC-44 — Dean approves leave:** Login as Dean → **Leave** → approve the pending request.
  **Expected:** status APPROVED.

## N. Notices
- **TC-45 — Post a notice:** Admin → **Notices** → create a notice for "Students".
  **Expected:** created; visible to a Student login under Notices.

---

## Reporting format (output this at the end)
```
| ID    | Result | Note |
|-------|--------|------|
| TC-01 | PASS   | ...  |
| ...   | ...    | ...  |
Summary: X passed, Y failed, Z N/A
```
List any FAILs first with what you saw vs. expected.
