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
| 3 | Dean dashboard: student fees pending | ⏳ Pending |
| 4 | Dean dashboard: staff payments pending | ⏳ Pending |
| 5 | Dean dashboard: salary paid to date | ⏳ Pending |
| 6 | Full & Final settlement (Dean approval) | ⏳ Pending |
| 7 | Teacher performance + parent/student feedback | ⏳ Pending |
| 8 | Student onboarding & retention (per academic year) | ⏳ Pending |
| 9 | Dean dashboard: overall expenditure | ⏳ Pending |
| 10 | Combine Students & Parents into one profile | ⏳ Pending |
| 11 | Feedback section (students/parents) | ⏳ Pending |
| 12 | Leave categories → Casual / Sick only | ⏳ Pending |
| 13 | Teacher ratings (students + parents) | ⏳ Pending |
| 14 | Accountant section | ✅ No change needed |

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

*Remaining requirements (#3–#13) are tracked in the status table above and will
be appended here as each is completed.*
