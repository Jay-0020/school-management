import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconCalendar } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { toast } from "../lib/toast";
import type {
  LeaveBalance,
  LeaveCategory,
  LeaveKind,
  LeaveRequest,
  LeaveStatus,
} from "../lib/types";

const categoryLabel: Record<LeaveCategory, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
  UNPAID: "Unpaid",
};

const statusClass: Record<LeaveStatus, string> = {
  PENDING: "inv-pending",
  APPROVED: "inv-paid",
  REJECTED: "inv-cancelled",
  CANCELLED: "inv-cancelled",
};
const kindLabel: Record<LeaveKind, string> = {
  ADVANCE: "Advance permission",
  JUSTIFICATION: "Absence justification",
};
const fmt = (d: string) => new Date(d).toLocaleDateString();
const errMsg = (err: unknown, f: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;

export function LeavePage() {
  const { user } = useAuth();
  const canApprove =
    user?.role === "TEACHER" ||
    user?.role === "DEAN" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<"mine" | "inbox">("mine");

  return (
    <AppShell title="Leave">
      <div className="page-head">
        <h2>Leave</h2>
        {tab === "mine" && <RequestButton />}
      </div>

      <BalanceStrip />

      {canApprove && (
        <div className="tabs">
          <button className={`tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
            My requests
          </button>
          <button className={`tab ${tab === "inbox" ? "active" : ""}`} onClick={() => setTab("inbox")}>
            Approvals
          </button>
        </div>
      )}

      {tab === "mine" ? <LeaveList scope="mine" /> : <LeaveList scope="inbox" />}
    </AppShell>
  );
}

function BalanceStrip() {
  const { data } = useQuery({
    queryKey: ["leave-balance"],
    queryFn: async () => (await api.get<{ balances: LeaveBalance[] }>("/leave/balance")).data.balances,
  });
  if (!data) return null;
  return (
    <div className="summary-strip">
      {data.map((b) => (
        <div className="summary-chip" key={b.category}>
          <span className="muted">{categoryLabel[b.category]} leave</span>
          <strong className={b.remaining <= 0 ? "pct-low" : "pct"}>
            {b.remaining}/{b.quota}
          </strong>
          <span className="muted">{b.used} used</span>
        </div>
      ))}
    </div>
  );
}

function RequestButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="inline-btn" onClick={() => setOpen(true)}>
        + Request leave
      </button>
      {open && <RequestModal onClose={() => setOpen(false)} />}
    </>
  );
}

function LeaveList({ scope }: { scope: "mine" | "inbox" }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["leave", scope],
    queryFn: async () =>
      (await api.get<{ items: LeaveRequest[] }>("/leave", { params: { scope } })).data.items,
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "APPROVED" | "REJECTED"; note?: string }) =>
      api.post(`/leave/${v.id}/decision`, { decision: v.decision, note: v.note ?? null }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(v.decision === "APPROVED" ? "Leave approved" : "Leave rejected");
    },
    onError: (e) => toast.error(errMsg(e, "Could not record decision")),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/leave/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave"] });
      toast.success("Request cancelled");
    },
  });

  if (isLoading) return <SkeletonRows />;
  if (!data || data.length === 0)
    return (
      <EmptyState
        icon={IconCalendar}
        title={scope === "mine" ? "No leave requests" : "Nothing to approve"}
        hint={
          scope === "mine"
            ? "Request a future day off, or justify a past absence."
            : "Requests awaiting your approval will appear here."
        }
      />
    );

  return (
    <div className="notice-list">
      {data.map((r) => {
        const who = r.applicant?.student
          ? `${r.applicant.student.firstName} ${r.applicant.student.lastName}`
          : r.applicant?.teacher
            ? `${r.applicant.teacher.firstName} ${r.applicant.teacher.lastName}`
            : r.applicant?.email;
        return (
          <article className="notice-card" key={r.id}>
            <div className="notice-top">
              <h3>
                <span className="audience-badge" style={{ marginRight: 8 }}>
                  {categoryLabel[r.category]}
                </span>
                {kindLabel[r.kind]} · {fmt(r.fromDate)}
                {r.toDate !== r.fromDate ? ` – ${fmt(r.toDate)}` : ""}
              </h3>
              <span className={`status ${statusClass[r.status]}`}>{r.status}</span>
            </div>
            <p className="notice-body">{r.reason}</p>
            <div className="notice-foot">
              <span className="muted">
                {scope === "inbox" ? `From ${who} · ${r.applicant?.role}` : ""}
                {r.decisionNote ? `Note: ${r.decisionNote}` : ""}
              </span>
              <span className="notice-actions">
                {scope === "mine" && r.status === "PENDING" && (
                  <button className="link danger" onClick={() => cancel.mutate(r.id)}>
                    Cancel
                  </button>
                )}
                {scope === "inbox" && r.status === "PENDING" && (
                  <>
                    <button
                      className="link"
                      onClick={() => decide.mutate({ id: r.id, decision: "APPROVED" })}
                    >
                      Approve
                    </button>
                    <button
                      className="link danger"
                      onClick={() => {
                        const note = window.prompt("Reason for rejection (optional):") ?? undefined;
                        decide.mutate({ id: r.id, decision: "REJECTED", note });
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState<LeaveKind>("ADVANCE");
  const [category, setCategory] = useState<LeaveCategory>("CASUAL");
  const [fromDate, setFrom] = useState(today);
  const [toDate, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => api.post("/leave", { kind, category, fromDate, toDate, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["leave-balance"] });
      toast.success("Leave request submitted");
      onClose();
    },
    onError: (e) => setError(errMsg(e, "Could not submit request")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) return setError("Please give a reason");
    submit.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Request leave</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Type
              <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)}>
                <option value="ADVANCE">Advance permission (future)</option>
                <option value="JUSTIFICATION">Justify a past absence</option>
              </select>
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LeaveCategory)}
              >
                <option value="CASUAL">Casual</option>
                <option value="SICK">Sick</option>
                <option value="EARNED">Earned</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </label>
            <label>
              From
              <input type="date" value={fromDate} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={toDate} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <label className="stack-label">
            Reason
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </label>
          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="inline-btn" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
