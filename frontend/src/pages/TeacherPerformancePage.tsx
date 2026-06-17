import { AppShell } from "../components/AppShell";
import { TeacherPerformance } from "../components/RatingWidgets";

export function TeacherPerformancePage() {
  return (
    <AppShell title="Teacher Performance">
      <h2>Teacher Performance</h2>
      <p className="muted">Average ratings from students &amp; parents (anonymous), with their comments.</p>
      <TeacherPerformance />
    </AppShell>
  );
}
