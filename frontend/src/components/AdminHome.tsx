import { Link } from "react-router-dom";
import type { ComponentType, SVGProps } from "react";
import { EnrolmentOverview } from "./EnrolmentOverview";
import { FinanceOverview } from "./FinanceOverview";
import { TeacherPerformance } from "./RatingWidgets";
import { StaffAttendanceOverview } from "./StaffCheckIn";
import { IconBell, IconBook, IconReceipt, IconRupee, IconStudents, IconTeacher } from "./icons";

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
  expenses: IconReceipt,
  classes: IconBook,
};

/** Admin / Super-Admin bento home — compact KPI tiles, a quick-action rail,
 *  then the finance / enrolment / performance tiles. */
export function AdminHome({
  stats,
  notices,
  actions,
}: {
  stats: Stat[];
  notices: NoticeBrief[];
  actions: Action[];
}) {
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

      <FinanceOverview />

      <div className="dash-cols">
        <EnrolmentOverview />
        <TeacherPerformance preview />
      </div>

      <div className="dash-cols">
        <StaffAttendanceOverview preview />

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
          <div className="tile-foot">
            <Link to="/notices">View all notices →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
