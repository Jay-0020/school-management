import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { EnrolmentOverview as Enr } from "../lib/types";

/** Dean / Admin onboarding & retention for the current academic session. */
export function EnrolmentOverview() {
  const { data } = useQuery({
    queryKey: ["enrolment-overview"],
    queryFn: async () => (await api.get<Enr>("/dashboard/enrolment")).data,
  });
  if (!data) return null;

  const cards = [
    { key: "new", label: "New admissions (this session)", value: String(data.newAdmissions) },
    { key: "left", label: "Students left (this session)", value: String(data.leftCount) },
    { key: "active", label: "Currently active", value: String(data.currentActive) },
    { key: "net", label: "Net change", value: `${data.netChange >= 0 ? "+" : ""}${data.netChange}` },
  ];

  return (
    <div className="widget">
      <p className="widget-title">Enrolment This Session</p>
      {!data.sessionConfigured && (
        <p className="muted">
          Set the session dates in <strong>School Setup → Academic calendar</strong> to track new
          admissions and departures.
        </p>
      )}
      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.key}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
          </div>
        ))}
      </div>

      {data.leftByReason.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: "0 0 8px" }}>Departures by reason</p>
          <div className="mini-list">
            {data.leftByReason.map((r) => (
              <div className="mini-row" key={r.reason}>
                <span className="mini-title">{r.reason}</span>
                <span className="mini-date">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
