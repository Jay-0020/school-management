import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonStats } from "../components/EmptyState";
import { IconStudents } from "../components/icons";
import { downloadFile, downloadPdf } from "../lib/download";
import { toast } from "../lib/toast";
import type { ChildOverview, ChildSummary, InvoiceStatus, ReportCard } from "../lib/types";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const invClass: Record<InvoiceStatus, string> = {
  PENDING: "inv-pending",
  PARTIAL: "inv-partial",
  PAID: "inv-paid",
  CANCELLED: "inv-cancelled",
};

export function ParentPage() {
  const [childId, setChildId] = useState("");
  const [reportExam, setReportExam] = useState<string | null>(null);

  const { data: children } = useQuery({
    queryKey: ["children"],
    queryFn: async () => (await api.get<{ items: ChildSummary[] }>("/parent/children")).data.items,
  });
  useEffect(() => {
    if (!childId && children?.length) setChildId(children[0].id);
  }, [children, childId]);

  const { data } = useQuery({
    queryKey: ["child-overview", childId],
    queryFn: async () =>
      (await api.get<ChildOverview>(`/parent/children/${childId}/overview`)).data,
    enabled: !!childId,
  });

  if (children && children.length === 0) {
    return (
      <AppShell title="My Children">
        <EmptyState icon={IconStudents} title="No children linked" hint="Ask the school to link your account to your child's record." />
      </AppShell>
    );
  }

  const att = data?.attendance[0];

  return (
    <AppShell title="My Children">
      <div className="page-head">
        <h2>My Children</h2>
        {children && children.length > 1 && (
          <select value={childId} onChange={(e) => setChildId(e.target.value)}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {data && (
        <p className="muted" style={{ marginTop: -8 }}>
          {data.student.name} · {data.student.admissionNo}{data.student.className ? ` · ${data.student.className}` : ""}
        </p>
      )}

      {!data ? (
        <SkeletonStats count={3} />
      ) : (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Attendance {att ? `(${att.year})` : ""}</div>
            <div className="stat-value">{att?.percent == null ? "—" : `${att.percent}%`}</div>
            {att && <div className="stat-hint">{att.present + att.late}/{att.total} present</div>}
          </div>
          <div className="stat-card">
            <div className="stat-label">Fees due</div>
            <div className="stat-value">{money(data.fees.due)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Homework</div>
            <div className="stat-value">{data.homework.length}</div>
            <div className="stat-hint">recent items</div>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Fees */}
          <section className="panel">
            <h3>Fees</h3>
            {data.fees.invoices.length === 0 ? (
              <p className="muted">No invoices.</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>Title</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.fees.invoices.map((i) => (
                    <tr key={i.id}>
                      <td>{i.title}</td><td>{money(i.total)}</td><td>{money(i.balance)}</td>
                      <td><span className={`status ${invClass[i.status]}`}>{i.status}</span></td>
                      <td>
                        <button className="link" onClick={() => downloadFile(`/fees/invoices/${i.id}/pdf`, `fees-${i.id.slice(-6)}.pdf`).catch(() => toast.error("Download failed"))}>
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Report cards */}
          <section className="panel">
            <h3>Report cards</h3>
            {data.exams.length === 0 ? (
              <p className="muted">No published results yet.</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>Exam</th><th>Term</th><th></th></tr></thead>
                <tbody>
                  {data.exams.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td><td>{e.term ?? "—"}</td>
                      <td><button className="link" onClick={() => setReportExam(e.id)}>View report</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Homework */}
          <section className="panel">
            <h3>Recent homework</h3>
            {data.homework.length === 0 ? (
              <p className="muted">Nothing assigned recently.</p>
            ) : (
              <div className="notice-list">
                {data.homework.map((h) => (
                  <article className="notice-card" key={h.id}>
                    <div className="notice-top">
                      <h3>{h.title}</h3>
                      {h.subject && <span className="audience-badge">{h.subject}</span>}
                    </div>
                    {h.dueDate && <p className="muted" style={{ margin: 0 }}>Due {new Date(h.dueDate).toLocaleDateString()}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {reportExam && data && (
        <ParentReportModal examId={reportExam} studentId={data.student.id} onClose={() => setReportExam(null)} />
      )}
    </AppShell>
  );
}

function ParentReportModal({ examId, studentId, onClose }: { examId: string; studentId: string; onClose: () => void }) {
  const { data: r } = useQuery({
    queryKey: ["parent-report", examId, studentId],
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
            <p className="muted">{r.student.name} · {r.student.admissionNo}</p>
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
                <tr><td><strong>Total</strong></td><td><strong>{r.totalObtained}/{r.totalMax}</strong></td><td><strong>{r.overallPercent == null ? "—" : `${r.overallPercent}%`}</strong></td><td><strong>{r.overallGrade ?? "—"}</strong></td></tr>
              </tbody>
            </table>
            <div className="form-actions">
              <button className="inline-btn ghost" onClick={() => downloadPdf(`/exams/${examId}/report/${studentId}/pdf`, "report-card.pdf")}>Download PDF</button>
              <button className="inline-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
