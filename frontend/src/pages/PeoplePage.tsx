import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { Avatar } from "../components/Avatar";
import { PhotoUploader } from "../components/PhotoUploader";
import { SkeletonRows } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { photoUrl } from "../lib/photoUrl";
import { toast } from "../lib/toast";
import type { AttendanceYear, PeopleDirectory, ProfileMe } from "../lib/types";

export function PeoplePage() {
  const { user } = useAuth();
  const showStaff = user?.role !== "TEACHER"; // dean/admin see staff too
  const [tab, setTab] = useState<"students" | "staff">("students");
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [staffType, setStaffType] = useState("");
  const [open, setOpen] = useState<{ id: string; name: string; hasPhoto: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["people"],
    queryFn: async () => (await api.get<PeopleDirectory>("/profile/people")).data,
  });

  // Distinct grades (numeric order) and sections for the filter dropdowns.
  const grades = useMemo(() => {
    const set = new Set((data?.students ?? []).map((s) => s.grade).filter(Boolean) as string[]);
    return [...set].sort(
      (a, b) => (parseInt(a.replace(/\D/g, "")) || 0) - (parseInt(b.replace(/\D/g, "")) || 0)
    );
  }, [data]);
  const sections = useMemo(() => {
    const set = new Set(
      (data?.students ?? [])
        .filter((s) => !grade || s.grade === grade)
        .map((s) => s.section)
        .filter(Boolean) as string[]
    );
    return [...set].sort();
  }, [data, grade]);

  const students = useMemo(
    () =>
      (data?.students ?? []).filter(
        (s) =>
          (s.name + s.admissionNo + s.className).toLowerCase().includes(q.toLowerCase()) &&
          (!grade || s.grade === grade) &&
          (!section || s.section === section)
      ),
    [data, q, grade, section]
  );
  const staff = useMemo(
    () =>
      (data?.staff ?? []).filter(
        (s) =>
          s.name.toLowerCase().includes(q.toLowerCase()) && (!staffType || s.staffType === staffType)
      ),
    [data, q, staffType]
  );

  return (
    <AppShell title="Directory">
      <div className="page-head">
        <h2>Directory</h2>
        <input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>

      {showStaff && (
        <div className="tabs">
          <button
            className={`tab ${tab === "students" ? "active" : ""}`}
            onClick={() => setTab("students")}
          >
            Students ({data?.students.length ?? 0})
          </button>
          <button className={`tab ${tab === "staff" ? "active" : ""}`} onClick={() => setTab("staff")}>
            Staff ({data?.staff.length ?? 0})
          </button>
        </div>
      )}

      {isLoading && <SkeletonRows />}

      <div className="controls" style={{ marginBottom: 14 }}>
        {(tab === "students" || !showStaff) && (
          <>
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setSection("");
              }}
            >
              <option value="">All grades</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </>
        )}
        {showStaff && tab === "staff" && (
          <select value={staffType} onChange={(e) => setStaffType(e.target.value)}>
            <option value="">All staff</option>
            <option value="TEACHING">Teaching</option>
            <option value="NON_TEACHING">Non-teaching</option>
          </select>
        )}
      </div>

      {!isLoading && (tab === "students" || !showStaff) && (
        <table className="data-table cards">
          <thead>
            <tr>
              <th>Admission no.</th>
              <th>Name</th>
              <th>Class · Section</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpen({ id: s.id, name: s.name, hasPhoto: s.hasPhoto })}>
                <td data-label="Admission no.">{s.admissionNo}</td>
                <td data-label="Name">
                  <span className="cell-person">
                    <Avatar src={s.hasPhoto ? photoUrl("students", s.id) : null} name={s.name} size={30} />
                    {s.name}
                  </span>
                </td>
                <td data-label="Class · Section">{s.className}</td>
                <td data-label="Attendance">
                  {s.attendancePercent === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={`pct ${s.attendancePercent < 75 ? "pct-low" : ""}`}>
                      {s.attendancePercent}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isLoading && showStaff && tab === "staff" && (
        <table className="data-table cards">
          <thead>
            <tr>
              <th>Employee no.</th>
              <th>Name</th>
              <th>Type</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td data-label="Employee no.">{s.employeeNo}</td>
                <td data-label="Name">
                  <span className="cell-person">
                    <Avatar src={s.hasPhoto ? photoUrl("teachers", s.id) : null} name={s.name} size={30} />
                    {s.name}
                  </span>
                </td>
                <td data-label="Type">{s.staffType === "TEACHING" ? "Teaching" : "Non-teaching"}</td>
                <td data-label="Attendance">
                  {s.attendancePercent === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={`pct ${s.attendancePercent < 75 ? "pct-low" : ""}`}>
                      {s.attendancePercent}%
                    </span>
                  )}
                  {s.presentToday && <span className="muted" style={{ marginLeft: 6 }}>· in today</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && <StudentDetail student={open} onClose={() => setOpen(null)} />}
    </AppShell>
  );
}

function StudentDetail({
  student,
  onClose,
}: {
  student: { id: string; name: string; hasPhoto: boolean };
  onClose: () => void;
}) {
  const { user } = useAuth();
  const id = student.id;
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const { data } = useQuery({
    queryKey: ["student-overview", id],
    queryFn: async () => (await api.get<ProfileMe>(`/profile/student/${id}`)).data,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <h3 style={{ marginBottom: 2 }}>{data.name}</h3>
            <p className="muted">
              {data.className} · Admission no. {data.admissionNo}
            </p>
            {canManage ? (
              <PhotoUploader kind="students" id={id} name={student.name} hasPhoto={student.hasPhoto} />
            ) : (
              <div className="photo-uploader">
                <Avatar src={student.hasPhoto ? photoUrl("students", id) : null} name={student.name} size={64} />
              </div>
            )}
            <h4 className="section-title">Attendance (by academic year)</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Excused</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {(data.attendance?.years ?? []).map((y: AttendanceYear) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td>{y.present}</td>
                    <td>{y.absent}</td>
                    <td>{y.late}</td>
                    <td>{y.excused}</td>
                    <td>
                      <span className={`pct ${y.percent !== null && y.percent < 75 ? "pct-low" : ""}`}>
                        {y.percent ?? "—"}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <FeedbackSection studentId={id} />

            <div className="form-actions">
              <button className="inline-btn ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const FEEDBACK_CATEGORIES = ["Academics", "Behaviour", "Sports", "Discipline", "Other"];
interface FeedbackEntry {
  id: string;
  type: "FEEDBACK" | "COMMENDATION";
  category: string;
  message: string;
  author: string;
  createdAt: string;
}

/** Staff: write feedback / commendations for a student + see the history. */
function FeedbackSection({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"FEEDBACK" | "COMMENDATION">("FEEDBACK");
  const [category, setCategory] = useState("Academics");
  const [message, setMessage] = useState("");

  const { data } = useQuery({
    queryKey: ["student-feedback", studentId],
    queryFn: async () =>
      (await api.get<{ items: FeedbackEntry[] }>(`/feedback/student/${studentId}`)).data.items,
  });

  const add = useMutation({
    mutationFn: () => api.post("/feedback", { studentId, type, category, message }),
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["student-feedback", studentId] });
      toast.success(type === "COMMENDATION" ? "👏 Commendation sent to the parents!" : "Feedback added");
    },
  });

  return (
    <>
      <h4 className="section-title">Feedback &amp; commendations</h4>
      <div className="form-grid">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="FEEDBACK">Feedback (student-facing)</option>
            <option value="COMMENDATION">Commendation (to parents)</option>
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="stack-label">
        Message
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <div className="form-actions" style={{ marginTop: 0 }}>
        <button
          className="inline-btn"
          disabled={!message.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? "Saving…" : "Add"}
        </button>
      </div>

      <div className="mini-list" style={{ marginTop: 10 }}>
        {data && data.length === 0 && <p className="muted">No feedback yet.</p>}
        {data?.map((f) => (
          <div className="mini-row" key={f.id}>
            <span className="mini-title">
              {f.type === "COMMENDATION" ? "👏 " : ""}
              <strong>{f.category}</strong> — {f.message}{" "}
              <span className="muted">· {f.author}</span>
            </span>
            <span className="mini-date">{new Date(f.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </>
  );
}
