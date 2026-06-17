import { Link } from "react-router-dom";
import type { ComponentType, SVGProps } from "react";
import { EnrolmentOverview } from "./EnrolmentOverview";
import { FinanceOverview } from "./FinanceOverview";
import { MyRatingCard, TeacherPerformance } from "./RatingWidgets";
import { SchoolCalendar } from "./SchoolCalendar";
import { StaffAttendanceOverview, StaffCheckInCard } from "./StaffCheckIn";
import {
  IconBell,
  IconBook,
  IconCalendar,
  IconReceipt,
  IconRupee,
  IconStudents,
  IconTeacher,
} from "./icons";
import type { Role, SchoolCalendar as Cal } from "../lib/types";

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
interface Action {
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const KPI_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  students: IconStudents,
  staff: IconTeacher,
  fees: IconRupee,
  dues: IconRupee,
  expenses: IconReceipt,
  classes: IconBook,
  sections: IconStudents,
  homework: IconBook,
  leave: IconCalendar,
};

/** Capped notices tile — top 3 + "View all". */
function NoticesTile({ notices }: { notices: NoticeBrief[] }) {
  return (
    <div className="widget preview-tile">
      <p className="widget-title">Recent notices</p>
      {notices.length === 0 && <p className="muted">No notices yet.</p>}
      <div className="mini-list">
        {notices.slice(0, 3).map((n) => (
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
      {notices.length > 0 && (
        <div className="tile-foot">
          <Link to="/notices">View all notices →</Link>
        </div>
      )}
    </div>
  );
}

/** One bento home for every role: compact KPI tiles + a quick-action rail, then
 *  a role-appropriate body. Replaces the old stacked stat-grid dashboard. */
export function RoleHome({
  role,
  stats,
  notices,
  actions,
  cal,
}: {
  role: Role;
  stats: Stat[];
  notices: NoticeBrief[];
  actions: Action[];
  cal?: Cal | null;
}) {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isManager = isAdmin || role === "DEAN";
  // People physically on campus who clock in (managers/admins don't).
  const showCheckIn = role === "TEACHER" || role === "DEAN" || role === "ACCOUNTANT";

  return (
    <>
      <div className="bento">
        {stats.map((s) => {
          const Icon = KPI_ICON[s.key] ?? IconBook;
          return (
            <div className="kpi-tile" key={s.key}>
              <span className="kpi-ico"><Icon /></span>
              <span className="kpi-value">{s.value}</span>
              <span className="kpi-label">{s.label}</span>
              {s.hint && <span className="kpi-hint">{s.hint}</span>}
            </div>
          );
        })}
      </div>

      <div className="chip-rail">
        {actions.map((a) => (
          <Link className="chip" to={a.path} key={a.path}>
            <a.icon className="nav-icon" />
            {a.label}
          </Link>
        ))}
      </div>

      {/* Self check-in for on-campus staff */}
      {showCheckIn && <StaffCheckInCard />}

      {/* Teacher: my anonymous rating */}
      {role === "TEACHER" && <MyRatingCard />}

      {/* Finance: managers + accountant */}
      {(isManager || role === "ACCOUNTANT") && <FinanceOverview />}

      {/* Manager analytics, paired into even 2-col rows */}
      {isManager && (
        <>
          <div className="dash-cols">
            <EnrolmentOverview />
            <TeacherPerformance preview />
          </div>
          <div className="dash-cols">
            <StaffAttendanceOverview preview />
            <NoticesTile notices={notices} />
          </div>
        </>
      )}

      {/* Non-managers: notices live in the body */}
      {!isManager && <NoticesTile notices={notices} />}

      {cal && (
        <div className="widget">
          <p className="widget-title">Academic calendar</p>
          <SchoolCalendar cal={cal} readOnly />
        </div>
      )}
    </>
  );
}
