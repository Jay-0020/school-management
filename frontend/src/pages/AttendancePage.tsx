import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import type {
  AttendanceStatus,
  AttendanceSummaryRow,
  ClassWithSections,
  RosterEntry,
} from "../lib/types";

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
const SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  EXCUSED: "E",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => `${new Date().toISOString().slice(0, 7)}-01`;

interface SectionOption {
  id: string;
  label: string;
}

export function AttendancePage() {
  const [tab, setTab] = useState<"mark" | "summary">("mark");
  const [sectionId, setSectionId] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
  });
  const sectionOptions: SectionOption[] = useMemo(
    () =>
      (classes ?? []).flatMap((c) =>
        c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))
      ),
    [classes]
  );

  // Default to the first section once classes load.
  useEffect(() => {
    if (!sectionId && sectionOptions.length) setSectionId(sectionOptions[0].id);
  }, [sectionOptions, sectionId]);

  return (
    <AppShell title="Attendance">
        <div className="page-head">
          <h2>Attendance</h2>
          <div className="controls">
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sectionOptions.length === 0 && <option value="">No sections</option>}
              {sectionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${tab === "mark" ? "active" : ""}`}
            onClick={() => setTab("mark")}
          >
            Mark
          </button>
          <button
            className={`tab ${tab === "summary" ? "active" : ""}`}
            onClick={() => setTab("summary")}
          >
            Summary
          </button>
        </div>

        {!sectionId ? (
          <div className="panel">
            <p className="muted">
              Add classes and sections in School Setup first, then assign students.
            </p>
          </div>
        ) : tab === "mark" ? (
          <MarkPanel sectionId={sectionId} />
        ) : (
          <SummaryPanel sectionId={sectionId} />
        )}
    </AppShell>
  );
}

// ── Mark attendance ─────────────────────────────────────────────────────────
function MarkPanel({ sectionId }: { sectionId: string }) {
  const [date, setDate] = useState(todayStr());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", sectionId, date],
    queryFn: async () =>
      (
        await api.get<{ roster: RosterEntry[] }>("/attendance", {
          params: { sectionId, date },
        })
      ).data.roster,
  });

  // Seed local marks from the roster: existing status, else default PRESENT.
  useEffect(() => {
    if (!data) return;
    const seed: Record<string, AttendanceStatus> = {};
    for (const r of data) seed[r.studentId] = r.status ?? "PRESENT";
    setMarks(seed);
    setSaved(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.post("/attendance", {
        sectionId,
        date,
        entries: Object.entries(marks).map(([studentId, status]) => ({
          studentId,
          status,
        })),
      }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function markAllPresent() {
    if (!data) return;
    const all: Record<string, AttendanceStatus> = {};
    for (const r of data) all[r.studentId] = "PRESENT";
    setMarks(all);
  }

  return (
    <section className="panel">
      <div className="mark-controls">
        <label className="inline-field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="inline-btn ghost" onClick={markAllPresent} disabled={!data?.length}>
          Mark all present
        </button>
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && (
        <p className="muted">No active students in this section.</p>
      )}

      {data && data.length > 0 && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Adm. No</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.studentId}>
                  <td>{r.admissionNo}</td>
                  <td>
                    {r.firstName} {r.lastName}
                  </td>
                  <td>
                    <div className="att-buttons">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          className={`att-btn att-${s} ${
                            marks[r.studentId] === s ? "selected" : ""
                          }`}
                          onClick={() =>
                            setMarks((m) => ({ ...m, [r.studentId]: s }))
                          }
                          title={s}
                        >
                          {SHORT[s]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="form-actions">
            {saved && <span className="ok inline">Saved ✓</span>}
            <button className="inline-btn" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save attendance"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────
function SummaryPanel({ sectionId }: { sectionId: string }) {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendance-summary", sectionId, from, to],
    queryFn: async () =>
      (
        await api.get<{ summary: AttendanceSummaryRow[] }>("/attendance/summary", {
          params: { sectionId, from, to },
        })
      ).data.summary,
  });

  return (
    <section className="panel">
      <div className="mark-controls">
        <label className="inline-field">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="inline-field">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {isError && <p className="error">Could not load summary (check the date range).</p>}
      {data && data.length === 0 && <p className="muted">No active students in this section.</p>}

      {data && data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Adm. No</th>
              <th>Name</th>
              <th>P</th>
              <th>A</th>
              <th>L</th>
              <th>E</th>
              <th>Days</th>
              <th>Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.studentId}>
                <td>{r.admissionNo}</td>
                <td>
                  {r.firstName} {r.lastName}
                </td>
                <td>{r.PRESENT}</td>
                <td>{r.ABSENT}</td>
                <td>{r.LATE}</td>
                <td>{r.EXCUSED}</td>
                <td>{r.marked}</td>
                <td>
                  {r.percent === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={`pct ${r.percent < 75 ? "pct-low" : ""}`}>
                      {r.percent}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
