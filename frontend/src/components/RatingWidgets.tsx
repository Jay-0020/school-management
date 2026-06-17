import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Bars, Ring } from "./charts";

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
        {data.average != null ? (
          <Ring value={data.average} max={5} size={96} label={`${data.average}`} color="#f5b301" />
        ) : (
          <div className="checkin-pct">—</div>
        )}
        <div>
          <div className="checkin-status">
            <strong style={{ color: "var(--text)" }}>{data.average ?? "—"} / 5</strong> average
          </div>
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

/** Dean / Admin teacher-performance. `preview` = compact dashboard tile that
 *  links to the full page; otherwise the full leaderboard + comments. */
export function TeacherPerformance({ preview = false }: { preview?: boolean }) {
  const { data } = useQuery({
    queryKey: ["teacher-perf"],
    queryFn: async () => (await api.get<Perf>("/ratings/teachers")).data,
  });
  if (!data) return null;

  if (preview) {
    return (
      <div className="widget preview-tile">
        <p className="widget-title">Teacher performance</p>
        {data.teachers.length === 0 ? (
          <p className="muted">No ratings yet.</p>
        ) : (
          <Bars
            data={data.teachers.slice(0, 3).map((t) => ({ label: t.name, value: t.average }))}
            max={5}
            unit="★"
          />
        )}
        <div className="tile-foot">
          <Link to="/teacher-performance">View all teachers →</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {data.teachers.length === 0 && <p className="muted">No ratings yet.</p>}
      {data.teachers.length > 0 && (
        <div className="panel">
          <p className="widget-title">Ratings</p>
          <Bars
            data={data.teachers.map((t) => ({ label: t.name, value: t.average }))}
            max={5}
            unit="★"
          />
        </div>
      )}
      {data.comments.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="widget-title">Recent comments</p>
          <div className="mini-list">
            {data.comments.map((c, i) => (
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
    </>
  );
}
