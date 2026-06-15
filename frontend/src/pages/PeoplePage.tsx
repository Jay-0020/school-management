import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { SkeletonRows } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import type { AttendanceYear, PeopleDirectory, ProfileMe } from "../lib/types";

export function PeoplePage() {
  const { user } = useAuth();
  const showStaff = user?.role !== "TEACHER"; // dean/admin see staff too
  const [tab, setTab] = useState<"students" | "staff">("students");
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [staffType, setStaffType] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

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
    <AppShell title="Overview">
      <div className="page-head">
        <h2>People Overview</h2>
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Adm. No</th>
              <th>Name</th>
              <th>Class · Section</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
                <td>{s.admissionNo}</td>
                <td>{s.name}</td>
                <td>{s.className}</td>
                <td>
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Emp. No</th>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.employeeNo}</td>
                <td>{s.name}</td>
                <td>{s.staffType === "TEACHING" ? "Teaching" : "Non-teaching"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId && <StudentDetail id={openId} onClose={() => setOpenId(null)} />}
    </AppShell>
  );
}

function StudentDetail({ id, onClose }: { id: string; onClose: () => void }) {
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
              {data.className} · Adm. {data.admissionNo}
            </p>
            <h4 className="section-title">Attendance by year</h4>
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
