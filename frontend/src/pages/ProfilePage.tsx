import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { SkeletonStats } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import type { ProfileMe } from "../lib/types";

export function ProfilePage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => (await api.get<ProfileMe>("/profile/me")).data,
  });

  return (
    <AppShell title="My Profile">
      <div className="profile-head">
        <span className="avatar avatar-lg">{(user?.email ?? "?").slice(0, 2).toUpperCase()}</span>
        <div>
          <h2 style={{ margin: 0 }}>{data?.name ?? user?.email}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {data?.type === "student"
              ? `${data.className ?? "—"} · Adm. ${data.admissionNo}`
              : `${user?.role}`}
          </p>
        </div>
      </div>

      {!data && <SkeletonStats count={3} />}

      {data?.type === "student" && data.attendance && (
        <>
          <h3 className="section-title">Attendance by year</h3>
          <div className="stat-grid">
            {data.attendance.years.map((y) => (
              <div className="stat-card" key={y.year}>
                <div className="stat-label">{y.year}</div>
                <div className="stat-value">{y.percent === null ? "—" : `${y.percent}%`}</div>
                <div className="stat-hint">
                  {y.present + y.late}/{y.total} present · {y.absent} absent · {y.excused} excused
                </div>
              </div>
            ))}
            {data.attendance.years.length === 0 && (
              <div className="stat-card muted">No attendance recorded yet.</div>
            )}
          </div>

          {data.attendance.monthly.length > 0 && (
            <div className="widget" style={{ marginTop: 18 }}>
              <p className="widget-title">Monthly — {data.attendance.years[0]?.year}</p>
              <div className="month-bars">
                {data.attendance.monthly.map((m) => (
                  <div className="month-bar" key={m.month}>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${m.percent !== null && m.percent < 75 ? "low" : ""}`}
                        style={{ height: `${m.percent ?? 0}%` }}
                      />
                    </div>
                    <span className="bar-pct">{m.percent ?? 0}%</span>
                    <span className="bar-label">{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {data?.type === "staff" && data.leave && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Approved leave days</div>
              <div className="stat-value">{data.leave.approvedDays}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending requests</div>
              <div className="stat-value">{data.leave.pending}</div>
            </div>
          </div>
          <h3 className="section-title">Recent leave</h3>
          {data.leave.recent.length === 0 ? (
            <p className="muted">No leave history.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.leave.recent.map((l) => (
                  <tr key={l.id}>
                    <td>{l.kind === "ADVANCE" ? "Advance" : "Justification"}</td>
                    <td>{l.from}</td>
                    <td>{l.to}</td>
                    <td>
                      <span
                        className={`status ${l.status === "APPROVED" ? "inv-paid" : l.status === "PENDING" ? "inv-pending" : "inv-cancelled"}`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td>{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {data?.type === "none" && <p className="muted">{data.message}</p>}
    </AppShell>
  );
}
