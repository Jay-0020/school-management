import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconBook } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { downloadPdf } from "../lib/download";
import { toast } from "../lib/toast";
import type {
  ClassWithSections,
  Exam,
  MarkRosterEntry,
  ReportCard,
  Subject,
} from "../lib/types";

const errMsg = (e: unknown, f: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;

export function ExamsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT" || user?.role === "PARENT";
  return (
    <AppShell title="Exams">
      {isStudent ? <StudentReports /> : <StaffExams isAdmin={user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"} />}
    </AppShell>
  );
}

// ════════════════════════ Staff ════════════════════════
function StaffExams({ isAdmin }: { isAdmin: boolean }) {
  const [openExam, setOpenExam] = useState<Exam | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => (await api.get<{ items: Exam[] }>("/exams")).data.items,
  });

  if (openExam) {
    return (
      <ExamDetail
        examId={openExam.id}
        isAdmin={isAdmin}
        classes={classes ?? []}
        onBack={() => setOpenExam(null)}
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <h2>Exams</h2>
        {isAdmin && (
          <button className="inline-btn" onClick={() => setCreating(true)}>
            + New exam
          </button>
        )}
      </div>

      {isLoading && <SkeletonRows />}
      {data && data.length === 0 && (
        <EmptyState icon={IconBook} title="No exams yet" hint="Create an exam, add subject papers, then enter marks." />
      )}
      {data && data.length > 0 && (
        <table className="data-table cards">
          <thead>
            <tr><th>Exam</th><th>Class</th><th>Term</th><th>Dates</th><th>Papers</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id} className="clickable" onClick={() => setOpenExam(e)}>
                <td data-label="Exam">{e.name}</td>
                <td data-label="Class">{e.class.name}</td>
                <td data-label="Term">{e.term ?? "—"}</td>
                <td data-label="Dates">
                  {e.startDate
                    ? `${new Date(e.startDate).toLocaleDateString()}${e.endDate ? " – " + new Date(e.endDate).toLocaleDateString() : ""}`
                    : "—"}
                </td>
                <td data-label="Papers">{e.papers.length}</td>
                <td data-label="Status"><span className={`status ${e.status === "PUBLISHED" ? "inv-paid" : "inv-pending"}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <ExamModal classes={classes ?? []} onClose={() => setCreating(false)} />}
    </>
  );
}

function ExamModal({ classes, onClose }: { classes: ClassWithSections[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [term, setTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post("/exams", {
        name,
        classId,
        term: term || null,
        startDate: startDate || null,
        endDate: endDate || null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); toast.success("Exam created"); onClose(); },
    onError: (e) => setError(errMsg(e, "Could not create exam")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !classId) return setError("Name and class are required");
    create.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New exam</h3>
        <form onSubmit={submit}>
          <label className="stack-label">Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Term 1 Examination" required />
          </label>
          <div className="form-grid">
            <label>Class
              <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Term
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term 1" />
            </label>
            <label>Start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>End date
              <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="inline-btn" disabled={create.isPending}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExamDetail({
  examId, isAdmin, classes, onBack,
}: { examId: string; isAdmin: boolean; classes: ClassWithSections[]; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: exam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => (await api.get<Exam>(`/exams/${examId}`)).data,
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await api.get<{ items: Subject[] }>("/schoolwork/subjects")).data.items,
    enabled: isAdmin,
  });

  const sectionOptions = useMemo(
    () => (exam ? (classes.find((c) => c.id === exam.classId)?.sections ?? []) : []),
    [classes, exam]
  );

  const refetchExam = () => qc.invalidateQueries({ queryKey: ["exam", examId] });

  const addPaper = useMutation({
    mutationFn: (v: { subjectId: string; maxMarks: number; passMarks: number; date: string | null }) =>
      api.post(`/exams/${examId}/papers`, v),
    onSuccess: () => { refetchExam(); toast.success("Paper added"); },
    onError: (e) => toast.error(errMsg(e, "Could not add paper")),
  });
  const delPaper = useMutation({
    mutationFn: (id: string) => api.delete(`/exams/papers/${id}`),
    onSuccess: refetchExam,
  });
  const publish = useMutation({
    mutationFn: (status: "DRAFT" | "PUBLISHED") => api.patch(`/exams/${examId}`, { status }),
    onSuccess: () => { refetchExam(); qc.invalidateQueries({ queryKey: ["exams"] }); toast.success("Updated"); },
  });

  const [subjectId, setSubjectId] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [passMarks, setPassMarks] = useState("33");
  const [paperDate, setPaperDate] = useState("");

  if (!exam) return <SkeletonRows />;

  return (
    <>
      <div className="page-head">
        <h2><button className="link" onClick={onBack}>← Exams</button> &nbsp; {exam.name}</h2>
        {isAdmin && (
          <button
            className="inline-btn"
            onClick={() => publish.mutate(exam.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
          >
            {exam.status === "PUBLISHED" ? "Unpublish" : "Publish report cards"}
          </button>
        )}
      </div>
      <p className="muted">{exam.class.name}{exam.term ? ` · ${exam.term}` : ""} · <span className={`status ${exam.status === "PUBLISHED" ? "inv-paid" : "inv-pending"}`}>{exam.status}</span></p>

      {/* Papers */}
      <section className="panel">
        <h3>Subjects & max marks</h3>
        {exam.papers.length === 0 && <p className="muted">No subjects added yet.</p>}
        {exam.papers.length > 0 && (
          <table className="data-table">
            <thead><tr><th>Subject</th><th>Date</th><th>Max</th><th>Pass</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {exam.papers.map((p) => (
                <tr key={p.id}>
                  <td>{p.subject.name}</td>
                  <td>{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                  <td>{p.maxMarks}</td><td>{p.passMarks}</td>
                  {isAdmin && <td><button className="link danger" onClick={() => delPaper.mutate(p.id)}>Remove</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isAdmin && (
          <form className="add-row" onSubmit={(e) => { e.preventDefault(); if (subjectId) { addPaper.mutate({ subjectId, maxMarks: Number(maxMarks), passMarks: Number(passMarks), date: paperDate || null }); setSubjectId(""); setPaperDate(""); } }}>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Add subject…</option>
              {(subjects ?? []).filter((s) => !exam.papers.some((p) => p.subjectId === s.id)).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={paperDate}
              min={exam.startDate ? exam.startDate.slice(0, 10) : undefined}
              max={exam.endDate ? exam.endDate.slice(0, 10) : undefined}
              onChange={(e) => setPaperDate(e.target.value)}
              style={{ maxWidth: 160 }}
              title={exam.startDate ? "Pick a date within the exam range" : "Exam date for this subject"}
            />
            <input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} style={{ maxWidth: 100 }} placeholder="Max" />
            <input type="number" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} style={{ maxWidth: 100 }} placeholder="Pass" />
            <button className="inline-btn" type="submit" disabled={!subjectId}>Add</button>
          </form>
        )}
      </section>

      {exam.papers.length > 0 && sectionOptions.length > 0 && (
        <MarksAndResults exam={exam} sections={sectionOptions} />
      )}
    </>
  );
}

function MarksAndResults({ exam, sections }: { exam: Exam; sections: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [paperId, setPaperId] = useState(exam.papers[0]?.id ?? "");
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});

  const paper = exam.papers.find((p) => p.id === paperId);

  const { data: roster } = useQuery({
    queryKey: ["exam-marks", exam.id, paperId, sectionId],
    queryFn: async () => {
      const r = (await api.get<{ maxMarks: number; roster: MarkRosterEntry[] }>(`/exams/${exam.id}/marks`, { params: { paperId, sectionId } })).data;
      setMarks(Object.fromEntries(r.roster.map((e) => [e.studentId, e.marksObtained == null ? "" : String(e.marksObtained)])));
      return r;
    },
    enabled: !!paperId && !!sectionId,
  });

  const save = useMutation({
    mutationFn: () => api.post(`/exams/${exam.id}/marks`, {
      paperId,
      entries: Object.entries(marks).filter(([, v]) => v !== "").map(([studentId, v]) => ({ studentId, marksObtained: Number(v) })),
    }),
    onSuccess: () => { toast.success("Marks saved"); qc.invalidateQueries({ queryKey: ["exam-results", exam.id, sectionId] }); },
    onError: (e) => toast.error(errMsg(e, "Could not save marks")),
  });

  const { data: results } = useQuery({
    queryKey: ["exam-results", exam.id, sectionId],
    queryFn: async () => (await api.get(`/exams/${exam.id}/results`, { params: { sectionId } })).data as { rows: { studentId: string; name: string; admissionNo: string; totalObtained: number; totalMax: number; percent: number | null; grade: string | null; rank: number }[] },
    enabled: !!sectionId,
  });

  return (
    <>
      <section className="panel">
        <h3>Enter marks</h3>
        <div className="mark-controls">
          <label className="inline-field">Section
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="inline-field">Subject
            <select value={paperId} onChange={(e) => setPaperId(e.target.value)}>
              {exam.papers.map((p) => <option key={p.id} value={p.id}>{p.subject.name} (max {p.maxMarks})</option>)}
            </select>
          </label>
        </div>
        {roster && roster.roster.length === 0 && <p className="muted">No students in this section.</p>}
        {roster && roster.roster.length > 0 && (
          <>
            <table className="data-table">
              <thead><tr><th>Adm. No</th><th>Name</th><th>Marks (/{paper?.maxMarks})</th></tr></thead>
              <tbody>
                {roster.roster.map((s) => (
                  <tr key={s.studentId}>
                    <td>{s.admissionNo}</td><td>{s.name}</td>
                    <td>
                      <input type="number" min={0} max={paper?.maxMarks} value={marks[s.studentId] ?? ""}
                        onChange={(e) => setMarks((m) => ({ ...m, [s.studentId]: e.target.value }))}
                        style={{ maxWidth: 90 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-actions">
              <button className="inline-btn" onClick={() => save.mutate()} disabled={save.isPending}>Save marks</button>
            </div>
          </>
        )}
      </section>

      {results && results.rows.length > 0 && (
        <section className="panel">
          <h3>Results — {sections.find((s) => s.id === sectionId)?.name}</h3>
          <table className="data-table">
            <thead><tr><th>Rank</th><th>Student</th><th>Total</th><th>%</th><th>Grade</th><th></th></tr></thead>
            <tbody>
              {results.rows.map((r) => (
                <tr key={r.studentId}>
                  <td>{r.rank}</td><td>{r.name}</td><td>{r.totalObtained}/{r.totalMax}</td>
                  <td>{r.percent ?? "—"}%</td><td>{r.grade ?? "—"}</td>
                  <td><button className="link" onClick={() => setReportFor(r.studentId)}>Report card</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {reportFor && <ReportCardModal examId={exam.id} studentId={reportFor} onClose={() => setReportFor(null)} />}
    </>
  );
}

// ════════════════════════ Student ════════════════════════
function StudentReports() {
  const [openExam, setOpenExam] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => (await api.get<{ studentId: string | null; items: { id: string; name: string; term: string | null }[] }>("/exams/mine/list")).data,
  });

  return (
    <>
      <h2>My Report Cards</h2>
      {data && data.items.length === 0 && (
        <EmptyState icon={IconBook} title="No report cards yet" hint="Your published exam results will appear here." />
      )}
      <div className="notice-list">
        {data?.items.map((e) => (
          <article className="notice-card clickable" key={e.id} onClick={() => setOpenExam(e.id)}>
            <div className="notice-top">
              <h3>{e.name}</h3>
              <span className="link">View report →</span>
            </div>
            {e.term && <p className="muted" style={{ margin: 0 }}>{e.term}</p>}
          </article>
        ))}
      </div>
      {openExam && data?.studentId && (
        <ReportCardModal examId={openExam} studentId={data.studentId} onClose={() => setOpenExam(null)} />
      )}
    </>
  );
}

// ════════════════════════ Report card ════════════════════════
function ReportCardModal({ examId, studentId, onClose }: { examId: string; studentId: string; onClose: () => void }) {
  const { data: r } = useQuery({
    queryKey: ["report", examId, studentId],
    queryFn: async () => (await api.get<ReportCard>(`/exams/${examId}/report/${studentId}`)).data,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!r ? <p className="muted">Loading…</p> : (
          <>
            <div className="notice-top">
              <h3>{r.exam.name}</h3>
              {r.result && <span className={`status ${r.result === "PASS" ? "inv-paid" : "inv-cancelled"}`}>{r.result}</span>}
            </div>
            <p className="muted">{r.student.name} · {r.student.admissionNo}{r.student.className ? ` · ${r.student.className}` : ""}</p>
            <table className="data-table">
              <thead><tr><th>Subject</th><th>Marks</th><th>%</th><th>Grade</th></tr></thead>
              <tbody>
                {r.subjects.map((s) => (
                  <tr key={s.subject}>
                    <td>{s.subject}</td>
                    <td className={s.passed === false ? "pct-low" : ""}>{s.marksObtained == null ? "—" : `${s.marksObtained}/${s.maxMarks}`}</td>
                    <td>{s.percent == null ? "—" : `${s.percent}%`}</td>
                    <td>{s.grade ?? "—"}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{r.totalObtained}/{r.totalMax}</strong></td>
                  <td><strong>{r.overallPercent == null ? "—" : `${r.overallPercent}%`}</strong></td>
                  <td><strong>{r.overallGrade ?? "—"}</strong></td>
                </tr>
              </tbody>
            </table>
            <div className="form-actions">
              <button
                className="inline-btn ghost"
                onClick={() => downloadPdf(`/exams/${examId}/report/${studentId}/pdf`, `report-${r.student.admissionNo}.pdf`)}
              >
                Download PDF
              </button>
              <button className="inline-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
