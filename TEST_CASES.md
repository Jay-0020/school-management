# School Management Portal — Full Browser Test Plan

**Instructions for the testing agent:** You are testing a live web app end to
end. Work through every case **in order**. For each: do the steps, check the
**Expected** result, and record **PASS / FAIL / N-A** with a one-line note.
Never stop on a failure — note it and continue. At the very end output a
**summary table** (ID · result · note), list FAILs first (what you saw vs.
expected), and give pass/fail/N-A counts.

This plan is organised so that **every role is fully exercised** (Part 2 walks
each role through every page it can open) plus the **cross-role workflows**
(Part 3) and **access-control checks** (Part 4).

## Environment
- **URL:** https://school-demo-nnfb.onrender.com
- **First load can take 30–60s** (server waking) — wait, don't fail.
- **All logins use password:** `Demo@1234`
- **Switch roles** via the top-right user menu → Log out, then log in again.

| Role | Email | Notes |
|---|---|---|
| Super Admin | superadmin@greenwood.demo | full system access |
| Admin | admin@greenwood.demo | runs the school |
| Dean | dean@greenwood.demo | oversight + approvals |
| Accountant | accountant@greenwood.demo | money |
| Teacher | teacher@greenwood.demo | class teacher of Grade 1-A |
| Student | student@greenwood.demo | Pooja Bose, Grade 1-A |
| Parent | parent@greenwood.demo | children: Pooja Bose, Diya Pillai |

### How to log in and switch roles (do this yourself for every role change)
1. Go to the URL. If the page is slow the first time, wait up to ~60s for it to wake.
2. On the login screen, type the role's **email** into the Email field and
   **`Demo@1234`** into the Password field, then click **Sign in / Log in**.
3. To switch roles: click the **user avatar/menu in the top-right corner** →
   **Log out**, then log in with the next role's email.
4. You have the credentials for every role in the table above — log in and out on
   your own as the cases require; do not ask the user to do it.

**Heads-up:** Many cases **change data** (approvals, ratings, complaints, marking
a student left, etc.) — that is expected on this demo. Follow the given order so
multi-step chains line up. Some actions may trigger a browser-agent confirmation
prompt — proceed once approved.

---

# Part 1 — Authentication
- **TC-01 Login (valid):** open URL → login as Admin. *Expected:* a Dashboard with school name "Greenwood High School".
- **TC-02 Login (invalid):** log out → Admin email + password `wrong`. *Expected:* error; not logged in.
- **TC-03 No forced password change:** logging in as each role goes straight to the dashboard. *Expected:* no "must change password" screen.
- **TC-04 Logout:** top-right menu → Log out. *Expected:* back to login screen.
- **TC-05 My Profile (any role):** login as Teacher → **My Profile**. *Expected:* profile details load; option to change password exists.

---

# Part 2 — Per-role walkthroughs (open every page the role can reach)

## 2A. Super Admin (`superadmin@greenwood.demo`)
- **TC-06** Dashboard loads with admin-level stats + Financial/Enrolment/Teacher-performance widgets.
- **TC-07** **People → Overview** opens (students + staff tabs, search, grade/section filters).
- **TC-08** **Students** list opens and paginates/filters.
- **TC-09** **Teachers & Staff** list opens.
- **TC-10** **Users** opens; try **+ Add user** form (don't need to submit) and open a user's **leave quota** editor — shows **Casual + Sick only** (no Earned).
- **TC-11** **Attendance**, **Schoolwork**, **Exams**, **Notes**, **Notices** each open.
- **TC-12** **Teaching Assignments**, **Fees**, **Payroll**, **Expenses**, **Settlements**, **School Setup**, **Complaints** each open without error.

## 2B. Admin (`admin@greenwood.demo`)
- **TC-13** Dashboard: stats + Financial overview + Enrolment + Teacher performance + read-only calendar.
- **TC-14** **School Setup → Branding:** edit a field (e.g., contact phone) → Save. *Expected:* "Saved".
- **TC-15** **School Setup → Campus location:** map renders (OpenStreetMap tiles, no broken images); change Radius then **Use my current location** → pin moves and **map recenters**.
- **TC-16** **School Setup → Academic calendar:** set session start/end + Saturday rule → Save; click a weekday → mark holiday with a note. *Expected:* Sundays green/locked; working-days count shown.
- **TC-17** **School Setup → Classes & sections:** add a class then a section under it, then delete them. *Expected:* add/delete work.
- **TC-18** **Students:** filter Grade 1 / Section A; open **Pooja Bose** — a "Parent account" column shows `parent@greenwood.demo`; admission date editable.
- **TC-19** **Students:** open a **Grade 5** student → set status **Transferred** → Save. *Expected:* status updates (feeds Dean enrolment "left").
- **TC-20** **Teachers & Staff:** open the list; open a staff member's detail.
- **TC-21** **Teaching Assignments:** pick Grade 1-A → assign a teacher to a subject; use **One teacher for all subjects**; **+ Add subject** (e.g., "Civics").
- **TC-22** **Notices:** create a notice (audience = Students) → it appears in the list.
- **TC-23** **Notes:** open; if a list exists, open an item's detail.
- **TC-24** **Exams:** open list (Dates column present); other exam actions tested in Part 3.

## 2C. Dean (`dean@greenwood.demo`)
- **TC-25** Dashboard: **Financial overview** (fees pending, staff payments pending, salary paid, total expenditure), **Enrolment this session** (new admissions / left / net), **Teacher performance**, academic calendar.
- **TC-26** **People → Overview:** filter students by **grade + section**; switch to **Staff** tab and filter Teaching/Non-teaching.
- **TC-27** **School Setup:** Dean can open it and **edit the calendar** (mark a holiday). *Expected:* calendar editable.
- **TC-28** **Teaching Assignments:** Dean can open and assign teachers / add a subject.
- **TC-29** **Exams:** open list (read/oversight).
- **TC-30** **Expenses:** open — Dean sees all expenses + a summary (approval tested in Part 3).
- **TC-31** **Settlements:** open list (create/approve in Part 3).
- **TC-32** **Complaints:** open — Dean sees the complaints list (resolve tested in Part 3).
- **TC-33** **Leave:** open — Dean sees pending staff leave to approve.
- **TC-34** **Notices:** open.

## 2D. Accountant (`accountant@greenwood.demo`)
- **TC-35** Dashboard: fees outstanding, expenses to review, payroll staff.
- **TC-36** **Fees:** invoice list with paid / partial / pending totals.
- **TC-37** **Fees:** open a pending/partial invoice → **record a payment** (amount + method) → save → status/paid amount updates.
- **TC-38** **Students** and **Teachers & Staff** lists open (read).
- **TC-39** **Payroll:** payslips list with PF/ESI/PT/TDS deductions; open a payslip.
- **TC-40** **Expenses:** open — can mark an approved expense paid (Part 3).
- **TC-41** **Settlements:** open — can mark an approved settlement paid (Part 3).

## 2E. Teacher (`teacher@greenwood.demo`)
- **TC-42** Dashboard: **My attendance / On-Campus** card + **My rating** card.
- **TC-43** **On-Campus check-in (EXPECTED N-A):** the agent isn't physically on campus, so it should show **"Not on campus (… m away)"** with the button disabled → record **N-A**. (Needs a real phone on site.) If it lets you check in, note it.
- **TC-44** **People → Overview:** open (students; staff hidden for teacher is OK).
- **TC-45** **Students:** open list.
- **TC-46** **Attendance:** open → mark daily attendance for the assigned section (Grade 1-A): set a couple of students present/absent → save.
- **TC-47** **Schoolwork:** assign a homework (title, section, subject, due date) → it's saved/listed.
- **TC-48** **Notes:** upload/share a note if the UI allows (or open the list).
- **TC-49** **Exams:** open; enter marks for a paper if available (Part 3 covers publish).
- **TC-50** **Payroll:** view own payslips.
- **TC-51** **Expenses:** submit an expense (Part 3).
- **TC-52** **Leave:** apply for leave — category options are **only Casual / Sick**.
- **TC-53** **Complaints:** file a complaint about a staff member (Part 3 covers Dean side).
- **TC-54** **Notices:** open; teachers can post a notice.

## 2F. Student (`student@greenwood.demo` — Pooja Bose)
- **TC-55** Dashboard: fees due + homework stats + calendar; no staff/admin menus.
- **TC-56** **Feedback → Rate your teachers:** rate a teacher 4–5★ + comment → Save → persists.
- **TC-57** **Feedback → Feedback & commendations:** shows feedback/commendations left by staff (after Part 3 TC-79/80).
- **TC-58** **Schoolwork:** view assigned homework + class material.
- **TC-59** **Exams:** view own published report card; **download as PDF**.
- **TC-60** **Notes:** view class notes.
- **TC-61** **Fees:** own invoice(s) + amount due.
- **TC-62** **Leave:** apply (Casual/Sick only).
- **TC-63** **Complaints:** file a complaint (optionally anonymous).
- **TC-64** **Notices:** read student-facing notices.

## 2G. Parent (`parent@greenwood.demo`)
- **TC-65** Dashboard loads (parent view).
- **TC-66** **My Children:** both **Pooja Bose** and **Diya Pillai** listed; select each → see attendance, fees, report card.
- **TC-67** **Feedback → Rate your teachers:** rate a child's teacher.
- **TC-68** **Feedback → Feedback & commendations:** see feedback + 👏 commendations for the children.
- **TC-69** **Fees:** each child's fee status / dues.
- **TC-70** **Complaints:** file a complaint (anonymous option).
- **TC-71** **Notices:** read notices.

---

# Part 3 — Cross-role workflows (multi-login chains)

## Expense approval
- **TC-72** Teacher → **Expenses → Submit:** category (dropdown), amount, description → Submit. *Expected:* SUBMITTED.
- **TC-73** Dean → **Expenses:** open it → **Approve**. *Expected:* APPROVED. (Confirm Dean has **no** "Mark paid" button.)
- **TC-74** Accountant → **Expenses:** open the approved one → **Mark paid**. *Expected:* PAID.

## Full & Final settlement
- **TC-75** Admin/Dean → **Settlements → New:** pick a staff member (pending salary auto-fills) → add bonus/deductions → Create. *Expected:* PENDING, Net = pending + bonus − deductions.
- **TC-76** Dean/Admin → open it → **Approve**. *Expected:* APPROVED (staff becomes inactive).
- **TC-77** Accountant → open it → **Mark paid**. *Expected:* PAID.

## Ratings / feedback / commendations visibility
- **TC-78** Student rates a teacher (TC-56) → Teacher → Dashboard **My rating** shows an updated average + count (anonymous). Dean → **Teacher performance** shows that teacher with stars + the comment.
- **TC-79** Teacher → **Overview → Students → Pooja Bose → Feedback & commendations:** add a **Feedback** (Academics). *Expected:* in her history.
- **TC-80** Same student → add a **Commendation** (Sports). *Expected:* in her history.
- **TC-81** Student (Pooja) → **Feedback:** sees the Feedback + Commendation. Parent → **Feedback:** also sees both (for Pooja).

## Complaint lifecycle
- **TC-82** Parent → **Complaints:** file an **anonymous** complaint about a staff member. *Expected:* confirmation; no list shown to the parent.
- **TC-83** Dean → **Complaints:** the complaint shows "Filed by: **Anonymous**" → open → **Mark resolved** → status Resolved.

## Leave approval
- **TC-84** Teacher → **Leave:** apply (Casual). Dean → **Leave:** approve it → APPROVED.

## Exam datesheet → report card
- **TC-85** Admin → **Exams → + New exam:** name, class, **Start + End date** → create → list shows a **Dates** column.
- **TC-86** Open it → add a subject with a date **inside** the range → added.
- **TC-87** Try a subject date **outside** the range → rejected/blocked.
- **TC-88** Open **Term 1 Examination** → subjects show per-subject dates (English 10 Dec … Social Studies 18 Dec).
- **TC-89** Teacher → enter marks for a paper → Admin publishes → Student → views/downloads report card PDF.

## Parent linking
- **TC-90** Admin → **Students → open a student → set "Parent account"** to `parent@greenwood.demo` → Save → that parent's **My Children** now includes this student.

## Enrolment reflects changes
- **TC-91** After TC-19 (a student transferred), Dean → Dashboard → **Enrolment** "students left this session" count ≥ 1.

---

# Part 4 — Access control (negative checks)
Type the path into the address bar after the site URL and observe.
- **TC-92** As **Student**, go to `/users`. *Expected:* redirected to dashboard / no access.
- **TC-93** As **Student**, go to `/setup`. *Expected:* redirected / no access.
- **TC-94** As **Parent**, go to `/complaints` and confirm there's **no list of all complaints** (only the file form).
- **TC-95** As **Teacher**, go to `/settlements`. *Expected:* redirected / no access.
- **TC-96** As **Accountant**, go to `/teaching` assignments path `/assignments`. *Expected:* redirected / no access.
- **TC-97** As **Dean**, confirm **Expenses** has no "Mark paid" action (approve/reject only).

---

## Reporting format (output at the end)
```
| ID    | Result | Note |
|-------|--------|------|
| TC-01 | PASS   | ...  |
| ...   | ...    | ...  |
Summary: X passed, Y failed, Z N/A
```
List all FAILs first (what you saw vs. what was expected).
