# School Management Portal — Full Browser Test Plan

**Instructions for the testing agent:** You are testing a live web app end to
end. Work through every case **in order**. For each: do the steps, check the
**Expected** result, and record **PASS / FAIL / N-A** with a one-line note.
Never stop on a failure — note it and continue. At the very end output a
**summary table** (ID · result · note), list FAILs first (what you saw vs.
expected), and give pass/fail/N-A counts.

This plan exercises **every role** (Part 2 walks each role through every page it
can open), the **cross-role workflows** (Part 3), the **online fee payment**
flow (Part 4), and **access-control checks** (Part 5).

## Environment
- **URL:** https://school-demo-nnfb.onrender.com
- **First load can take 30–60s** (server waking) — wait, don't fail.
- **All logins use password:** `Demo@1234`
- **Switch roles** via the top-right user menu → Log out, then log in again.
- The app is **mobile-first**: on a narrow window, tables show as **cards** and
  the menu is a **bottom bar + "More"**. On desktop it's a left sidebar. Either
  is fine — find the same labels.

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
2. On the login screen, type the role's **email** + **`Demo@1234`** → **Sign in**.
3. To switch roles: top-right **user avatar/menu** → **Log out**, then log in with the next role.
4. You have every role's credentials above — log in/out on your own; never ask the user to.

**Naming note (menu labels):** People group has **Directory** (the student/staff
list), **Students**, **Teachers & Staff**, **Staff Attendance**, **Teacher
Performance**, **User Accounts**. Academics has **Attendance**, **Homework**,
**Exams**, **Study Notes**, **Notices**, **Teaching Assignments**. Finance has
**Fees**, **Payroll**, **Expenses**, **Final Settlements**.

**Heads-up:** Many cases **change data** (approvals, ratings, complaints, marking
a student left, payments, etc.) — that is expected on this demo. Follow the given
order so multi-step chains line up. Some actions may trigger a browser-agent
confirmation prompt — proceed once approved.

---

# Part 1 — Authentication
- **TC-01 Login (valid):** open URL → login as Admin. *Expected:* a Dashboard with school name "Greenwood High School".
- **TC-02 Login (invalid):** log out → Admin email + password `wrong`. *Expected:* error; not logged in.
- **TC-03 No forced password change:** logging in as each role goes straight to the dashboard. *Expected:* no "must change password" screen.
- **TC-04 Logout:** top-right menu → Log out. *Expected:* back to login screen.
- **TC-05 My Profile (any role):** login as Teacher → **My Profile**. *Expected:* profile details load; a change-password option exists.

---

# Part 2 — Per-role walkthroughs (open every page the role can reach)

## 2A. Super Admin (`superadmin@greenwood.demo`)
- **TC-06** Dashboard loads with admin KPI tiles + **Financial Overview / Enrolment This Session / Teacher Performance / Staff Attendance / Recent Notices** widgets.
- **TC-07** **People → Directory** opens (Students + Staff tabs, search, grade/section filters).
- **TC-08** **People → Students** list opens and paginates/filters (search + section + status).
- **TC-09** **People → Teachers & Staff** list opens (search + type + status filters).
- **TC-10** **People → User Accounts** opens; try **+ Add user** (don't submit); open a user's **Leave Quota** editor — shows **Casual + Sick only** (no Earned).
- **TC-11** **People → Staff Attendance** and **People → Teacher Performance** pages each open (full lists, not just dashboard previews).
- **TC-12** **Attendance**, **Homework**, **Exams**, **Study Notes**, **Notices** each open.
- **TC-13** **Teaching Assignments**, **Fees**, **Payroll**, **Expenses**, **Final Settlements**, **School Setup**, **Activity Log**, **Complaints** each open without error.

## 2B. Admin (`admin@greenwood.demo`)
- **TC-14** Dashboard: KPI tiles + Financial Overview + Enrolment + Teacher Performance + read-only Academic Calendar.
- **TC-15** **School Setup → Branding & Details:** edit a field (e.g., contact phone) → Save. *Expected:* "Saved".
- **TC-16** **School Setup → Campus Location & Check-in Area:** map renders (OpenStreetMap tiles, no broken images); change Radius then **Use my current location** → pin moves and **map recenters**.
- **TC-17** **School Setup → Academic Calendar:** set session start/end + Saturday rule → Save; click a weekday → mark holiday with a note. *Expected:* Sundays locked; working-days count shown.
- **TC-18** **School Setup → Classes & Sections:** add a class then a section under it, then delete them. *Expected:* add/delete work.
- **TC-19** **Students:** filter Grade 1 / Section A; open **Pooja Bose** — a "Parent account" column shows `parent@greenwood.demo`; admission date editable.
- **TC-20** **Students:** open a **Grade 5** student → set status **Transferred** → Save. *Expected:* status updates (feeds Dean enrolment "left").
- **TC-21** **Teachers & Staff:** open the list; open a staff member's detail.
- **TC-22** **Teaching Assignments:** pick Grade 1-A → assign a teacher to a subject; use **One teacher for all subjects**; **+ Add subject** (e.g., "Civics").
- **TC-23** **Notices:** create a notice (audience = Students) → it appears in the list.
- **TC-24** **Study Notes:** open; if a list exists, open an item's detail.
- **TC-25** **Exams:** open list (a **Dates** column and a **Subjects** count column are present); other exam actions in Part 3.

## 2C. Dean (`dean@greenwood.demo`)
- **TC-26** Dashboard: **Financial Overview** (fees pending, staff payments pending, salary paid, total expenditure), **Enrolment This Session** (new / left / net), **Teacher Performance**, **Staff Attendance**, Academic Calendar.
- **TC-27** **People → Directory:** filter students by **grade + section**; switch to **Staff** tab and filter Teaching/Non-teaching.
- **TC-28** **People → Staff Attendance** and **Teacher Performance** pages open with full data.
- **TC-29** **School Setup:** Dean can open it and **edit the calendar** (mark a holiday). *Expected:* editable.
- **TC-30** **Teaching Assignments:** Dean can open and assign teachers / add a subject.
- **TC-31** **Exams:** open list (read/oversight).
- **TC-32** **Expenses:** open — Dean sees all expenses + a summary (approval in Part 3).
- **TC-33** **Final Settlements:** open list (create/approve in Part 3).
- **TC-34** **Complaints:** open — Dean sees the complaints list with a **status filter** (resolve in Part 3).
- **TC-35** **Leave:** open — Dean sees pending staff leave to approve.
- **TC-36** **Notices:** open.

## 2D. Accountant (`accountant@greenwood.demo`)
- **TC-37** Dashboard: fees outstanding, expenses to review, payroll staff; Financial Overview widget.
- **TC-38** **Fees:** invoice list with paid / partial / pending; filter by section + status.
- **TC-39** **Fees:** open a pending/partial invoice → **record a payment** (amount + method) → save → status/paid amount updates.
- **TC-40** **Students** and **Teachers & Staff** lists open (read).
- **TC-41** **Payroll:** payslips list with PF/ESI/PT/TDS deductions; open a payslip.
- **TC-42** **Expenses:** open — can mark an approved expense paid (Part 3).
- **TC-43** **Final Settlements:** open — can mark an approved settlement paid (Part 3).

## 2E. Teacher (`teacher@greenwood.demo`)
- **TC-44** Dashboard: **My Attendance / On-Campus** card + **My Rating** card.
- **TC-45** **On-Campus check-in (EXPECTED N-A):** the agent isn't physically on campus, so it should show **"Not on campus (… m away)"** with the button disabled → record **N-A**. If it lets you check in, note it.
- **TC-46** **People → Directory:** opens (students; staff tab hidden for teacher is OK).
- **TC-47** **Students:** open list.
- **TC-48** **Attendance:** mark daily attendance for Grade 1-A — set a couple present/absent → save.
- **TC-49** **Homework:** assign homework (title, section, subject, due date) → it's saved/listed.
- **TC-50** **Study Notes:** upload/share a note if the UI allows (or open the list).
- **TC-51** **Exams:** open; enter marks for a subject if available (publish in Part 3).
- **TC-52** **Payroll:** view own payslips.
- **TC-53** **Expenses:** submit an expense (Part 3).
- **TC-54** **Leave:** apply — category options are **only Casual / Sick**.
- **TC-55** **Complaints:** file a complaint about a staff member (Part 3 covers Dean side).
- **TC-56** **Notices:** open; teachers can post a notice.

## 2F. Student (`student@greenwood.demo` — Pooja Bose)
- **TC-57** Dashboard: fees due + homework stats + calendar; no staff/admin menus.
- **TC-58** **Feedback → Rate Your Teachers:** rate a teacher 4–5★ + comment → Save → persists.
- **TC-59** **Feedback → Feedback & commendations:** shows feedback/commendations left by staff (after Part 3 TC-86/87).
- **TC-60** **Homework:** view assigned homework + class material.
- **TC-61** **Exams:** view own published report card; **download as PDF**.
- **TC-62** **Study Notes:** view class notes.
- **TC-63** **Fees:** own invoice(s) + amount due.
- **TC-64** **Leave:** apply (Casual/Sick only).
- **TC-65** **Complaints:** file a complaint (optionally anonymous).
- **TC-66** **Notices:** read student-facing notices.

## 2G. Parent (`parent@greenwood.demo`)
- **TC-67** Dashboard loads (parent view).
- **TC-68** **My Children:** both **Pooja Bose** and **Diya Pillai** listed; select each → see attendance, fees, report card.
- **TC-69** **Feedback → Rate Your Teachers:** rate a child's teacher.
- **TC-70** **Feedback → Feedback & commendations:** see feedback + 👏 commendations for the children.
- **TC-71** **Fees:** each child's fee status / dues.
- **TC-72** **Complaints:** file a complaint (anonymous option).
- **TC-73** **Notices:** read notices.

---

# Part 3 — Cross-role workflows (multi-login chains)

## Expense approval
- **TC-74** Teacher → **Expenses → Submit Expense:** category (dropdown), amount, description → Submit. *Expected:* SUBMITTED.
- **TC-75** Dean → **Expenses:** open it → **Approve**. *Expected:* APPROVED. (Confirm Dean has **no** "Mark as paid" button.)
- **TC-76** Accountant → **Expenses:** open the approved one → **Mark as paid**. *Expected:* PAID.

## Full & Final settlement
- **TC-77** Admin/Dean → **Final Settlements → New:** pick a staff member (pending salary auto-fills) → add bonus/deductions → Create. *Expected:* PENDING, Net = pending + bonus − deductions.
- **TC-78** Dean/Admin → open it → **Approve**. *Expected:* APPROVED (staff becomes inactive).
- **TC-79** Accountant → open it → **Mark as paid**. *Expected:* PAID.

## Ratings / feedback / commendations visibility
- **TC-80** Student rates a teacher (TC-58) → Teacher → Dashboard **My Rating** shows updated average + count (anonymous). Dean → **Teacher Performance** shows that teacher with stars + the comment.
- **TC-81** Teacher → **Directory → Students → Pooja Bose → Feedback & commendations:** add a **Feedback** (Academics). *Expected:* in her history.
- **TC-82** Same student → add a **Commendation** (Sports). *Expected:* in her history.
- **TC-83** Student (Pooja) → **Feedback:** sees the Feedback + Commendation. Parent → **Feedback:** also sees both (for Pooja).

## Complaint lifecycle
- **TC-84** Parent → **Complaints:** file an **anonymous** complaint about a staff member. *Expected:* confirmation; no list shown to the parent.
- **TC-85** Dean → **Complaints:** the complaint shows "Filed by: **Anonymous**" → open → **Mark resolved** → status Resolved. (Use the **status filter** to find Open/Resolved.)

## Leave approval
- **TC-86** Teacher → **Leave:** apply (Casual). Dean → **Leave:** approve it → APPROVED.

## Exam datesheet → report card
- **TC-87** Admin → **Exams → + New exam:** name, class, **Start + End date** → create → list shows a **Dates** column.
- **TC-88** Open it → add a **subject** with a date **inside** the range → added.
- **TC-89** Try a subject date **outside** the range → rejected/blocked.
- **TC-90** Open **Term 1 Examination** → subjects show per-subject dates (English 10 Dec … Social Studies 18 Dec).
- **TC-91** Teacher → enter marks for a subject → Admin publishes → Student → views/downloads report card PDF.

## Parent linking
- **TC-92** Admin → **Students → open a student → set "Parent account"** to `parent@greenwood.demo` → Save → that parent's **My Children** now includes this student.

## Enrolment reflects changes
- **TC-93** After TC-20 (a student transferred), Dean → Dashboard → **Enrolment This Session** "students left" count ≥ 1.

---

# Part 4 — Online fee payment (Razorpay, TEST mode)

> **Precondition:** Razorpay test keys are configured on the server, so online
> pay is **enabled**. If the **"Pay online"** button does NOT appear on an unpaid
> invoice, online pay is off (keys not set) → mark **TC-94 FAIL** and the rest of
> Part 4 **N-A**.
>
> **Test payment instruments (no real money):**
> - **Card:** `4111 1111 1111 1111`, any future expiry (e.g. 12/30), any CVV, any name; on the bank/OTP step choose **Success**.
> - **UPI:** `success@razorpay` (succeeds) / `failure@razorpay` (fails).
>
> The payment opens in a **Razorpay Checkout** popup/iframe. Interact with it to
> complete the test payment. If the agent cannot drive the Razorpay popup,
> complete TC-94/TC-95 (button + breakdown appear, checkout opens) and mark the
> payment-completion cases **N-A** with a note.

- **TC-94 Pay-online visible:** Parent → **Fees** → open a **PENDING/PARTIAL** invoice (e.g. Pooja Bose's). *Expected:* a **"Pay online"** section showing a breakdown like **"₹X fee + ₹Y processing (2.36%) = ₹Z"** and a **Pay ₹Z online** button.
- **TC-95 Checkout opens:** click **Pay online**. *Expected:* the **Razorpay Checkout** window opens showing the **gross amount (₹Z)** and payment methods (UPI / Card / Netbanking).
- **TC-96 Pay by test card (happy path):** in Checkout choose **Card** → `4111 1111 1111 1111`, 12/30, any CVV → pay → choose **Success** on the bank page. *Expected:* Checkout closes, a **"Payment successful"** message, and the invoice flips to **PAID** (or PARTIAL→ less balance) with a new payment row **method = ONLINE**, reference starting **"Razorpay …"**.
- **TC-97 Amount credited correctly:** confirm only the **fee amount (₹X)**, not the gross with surcharge, was credited to the invoice balance. *Expected:* invoice "Paid" increased by ₹X; it reads PAID when fully covered.
- **TC-98 Already-paid invoice:** reopen the now-PAID invoice. *Expected:* **no "Pay online"** button (nothing due).
- **TC-99 Failed/cancelled payment:** open another unpaid invoice → Pay online → in Checkout either **close it** or use UPI `failure@razorpay`. *Expected:* invoice **stays unpaid** (no false "paid"); a graceful error/dismiss, no crash.
- **TC-100 Manager sees the online payment:** Accountant/Admin → **Fees** → open the invoice paid in TC-96. *Expected:* the **ONLINE** payment appears in the payments list with the Razorpay reference.
- **TC-101 Webhook (EXPECTED N-A):** the test Razorpay account's webhook may be gated behind activation, so server-side webhook confirmation isn't wired → record **N-A**. (The in-browser verify in TC-96 already settles the invoice.)

---

# Part 5 — Access control (negative checks)
Type the path into the address bar after the site URL and observe.
- **TC-102** As **Student**, go to `/users`. *Expected:* redirected to dashboard / no access.
- **TC-103** As **Student**, go to `/setup`. *Expected:* redirected / no access.
- **TC-104** As **Parent**, go to `/complaints` — confirm there's **no list of all complaints** (only the file form).
- **TC-105** As **Teacher**, go to `/settlements`. *Expected:* redirected / no access.
- **TC-106** As **Accountant**, go to `/assignments`. *Expected:* redirected / no access.
- **TC-107** As **Dean**, confirm **Expenses** has no "Mark as paid" action (approve/reject only).
- **TC-108** As **Student/Parent**, you can only **Pay online** your own invoice — there's no way to open another family's invoice (the Fees list only shows your own).

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
