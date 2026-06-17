import { AppShell } from "../components/AppShell";
import { StaffAttendanceOverview } from "../components/StaffCheckIn";

export function StaffAttendancePage() {
  return (
    <AppShell title="Staff Attendance">
      <h2>Staff Attendance</h2>
      <p className="muted">Every staff member's check-in percentage this session.</p>
      <StaffAttendanceOverview />
    </AppShell>
  );
}
