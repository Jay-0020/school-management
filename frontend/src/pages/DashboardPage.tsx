import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EnrolmentOverview } from "../components/EnrolmentOverview";
import { FinanceOverview } from "../components/FinanceOverview";
import { MyRatingCard, TeacherPerformance } from "../components/RatingWidgets";
import { SchoolCalendar } from "../components/SchoolCalendar";
import { StaffAttendanceOverview, StaffCheckInCard } from "../components/StaffCheckIn";
import { SkeletonStats } from "../components/EmptyState";
import { IconBell } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import { navForRole } from "../lib/nav";
import type { SchoolCalendar as Cal } from "../lib/types";

interface Stat {
  key: string;
  label: string;
  value: string;
  hint?: string;
}
interface NoticeBrief {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
}

const STAFF_ROLES = ["TEACHER", "DEAN", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];
const MANAGER_ROLES = ["DEAN", "ADMIN", "SUPER_ADMIN"];

export function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useBranding();

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () =>
      (await api.get<{ stats: Stat[]; notices: NoticeBrief[] }>("/dashboard")).data,
  });

  const { data: cal } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => (await api.get<Cal>("/school/calendar")).data,
  });

  if (!user) return null;

  const isStaff = STAFF_ROLES.includes(user.role);
  const isManager = MANAGER_ROLES.includes(user.role);

  // Quick actions = the user's nav items (minus Dashboard itself).
  const actions = navForRole(user.role)
    .flatMap((g) => g.items)
    .filter((i) => i.path !== "/")
    .slice(0, 8);

  const greeting = settings?.name ?? "your school";

  return (
    <AppShell title="Dashboard">
      <div className="dash-hero">
        <h2>Welcome back 👋</h2>
        <p className="muted">Here's what's happening at {greeting}.</p>
      </div>

      <div className="dash-stack">
      {!data ? (
        <SkeletonStats count={5} />
      ) : (
        <div className="stat-grid">
          {data.stats.map((s) => (
            <div className="stat-card" key={s.key}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              {s.hint && <div className="stat-hint">{s.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {isStaff && <StaffCheckInCard />}

      {user.role === "TEACHER" && <MyRatingCard />}

      {isManager && <FinanceOverview />}

      {isManager && <EnrolmentOverview />}

      {isManager && <TeacherPerformance />}

      <div className="dash-cols">
        <div className="widget">
          <p className="widget-title">Quick actions</p>
          <div className="quick-actions">
            {actions.map((a) => (
              <Link className="quick-action" to={a.path} key={a.path}>
                <a.icon className="nav-icon" />
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="widget">
          <p className="widget-title">Recent notices</p>
          {data && data.notices.length === 0 && <p className="muted">No notices yet.</p>}
          <div className="mini-list">
            {data?.notices.map((n) => (
              <Link to="/notices" className="mini-row" key={n.id}>
                <IconBell className="nav-icon" />
                <span className="mini-title">
                  {n.pinned && "📌 "}
                  {n.title}
                </span>
                <span className="mini-date">{new Date(n.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {isManager && <StaffAttendanceOverview />}

      {cal && (
        <div className="widget">
          <p className="widget-title">Academic calendar</p>
          <SchoolCalendar cal={cal} readOnly />
        </div>
      )}
      </div>
    </AppShell>
  );
}
