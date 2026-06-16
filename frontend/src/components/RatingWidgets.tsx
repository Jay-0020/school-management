import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface MyRating {
  average: number | null;
  count: number;
  comments: { stars: number; comment: string; createdAt: string }[];
}
interface Perf {
  teachers: { teacherId: string; name: string; employeeNo: string; average: number; count: number }[];
  comments: { teacher: string; stars: number; comment: string; createdAt: string }[];
}

/** A teacher's own (anonymous) rating summary. */
export function MyRatingCard() {
  const { data } = useQuery({
    queryKey: ["my-rating"],
    queryFn: async () => (await api.get<MyRating>("/ratings/me")).data,
  });
  if (!data) return null;
  return (
    <div className="widget">
      <p className="widget-title">My rating</p>
      <div className="checkin-card">
        <div>
          <div className="checkin-pct">{data.average != null ? `${data.average}★` : "—"}</div>
          <div className="checkin-status">
            {data.count} rating{data.count === 1 ? "" : "s"} from students &amp; parents
          </div>
        </div>
      </div>
      {data.comments.length > 0 && (
        <div className="mini-list" style={{ marginTop: 10 }}>
          {data.comments.slice(0, 5).map((c, i) => (
            <div className="mini-row" key={i}>
              <span className="mini-title">“{c.comment}”</span>
              <span className="mini-date">{c.stars}★</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dean / Admin teacher-performance leaderboard + recent comments. */
export function TeacherPerformance() {
  const { data } = useQuery({
    queryKey: ["teacher-perf"],
    queryFn: async () => (await api.get<Perf>("/ratings/teachers")).data,
  });
  if (!data) return null;
  return (
    <div className="widget">
      <p className="widget-title">Teacher performance</p>
      {data.teachers.length === 0 && <p className="muted">No ratings yet.</p>}
      <div className="mini-list">
        {data.teachers.slice(0, 15).map((t) => (
          <div className="mini-row" key={t.teacherId}>
            <span className="mini-title">
              {t.name} <span className="muted">· {t.employeeNo}</span>
            </span>
            <span className="mini-date">
              {t.average}★ ({t.count})
            </span>
          </div>
        ))}
      </div>
      {data.comments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: "0 0 6px" }}>Recent comments</p>
          <div className="mini-list">
            {data.comments.slice(0, 8).map((c, i) => (
              <div className="mini-row" key={i}>
                <span className="mini-title">
                  “{c.comment}” <span className="muted">— {c.teacher}</span>
                </span>
                <span className="mini-date">{c.stars}★</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
