import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import type { Expense, ExpenseStatus, ExpenseSummaryRow } from "../lib/types";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const STATUSES: ExpenseStatus[] = ["SUBMITTED", "APPROVED", "REJECTED", "PAID"];
const CATEGORIES = ["Stationery", "Maintenance", "Travel", "Utilities", "Events", "Supplies"];
const statusClass: Record<ExpenseStatus, string> = {
  SUBMITTED: "inv-pending",
  APPROVED: "inv-partial",
  REJECTED: "inv-cancelled",
  PAID: "inv-paid",
};

function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}

export function ExpensesPage() {
  const { user } = useAuth();
  const isManager =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";

  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", isManager ? status : "mine"],
    queryFn: async () => {
      const params = isManager && status ? { status } : {};
      return (await api.get<{ items: Expense[] }>("/expenses", { params })).data.items;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["expense-summary"],
    queryFn: async () =>
      (await api.get<{ summary: ExpenseSummaryRow[] }>("/expenses/summary")).data.summary,
    enabled: isManager,
  });

  return (
    <AppShell title="Expenses">
        <div className="page-head">
          <h2>{isManager ? "Expense Approvals" : "My Expenses"}</h2>
          <div className="controls">
            {isManager && (
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            <button className="inline-btn" onClick={() => setSubmitting(true)}>
              + Submit expense
            </button>
          </div>
        </div>

        {isManager && summary && summary.length > 0 && (
          <div className="summary-strip">
            {summary.map((s) => (
              <div className="summary-chip" key={s.status}>
                <span className={`status ${statusClass[s.status]}`}>{s.status}</span>
                <strong>{money(s.total)}</strong>
                <span className="muted">{s.count} item(s)</span>
              </div>
            ))}
          </div>
        )}

        {isLoading && <p className="muted">Loading…</p>}
        {data && data.length === 0 && <p className="muted">No expenses.</p>}

        {data && data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                {isManager && <th>Submitted by</th>}
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setOpenId(e.id)}>
                  <td>{e.category}</td>
                  <td>{money(e.amount)}</td>
                  {isManager && <td>{e.submittedBy?.email ?? "—"}</td>}
                  <td>
                    {e.expenseDate
                      ? new Date(e.expenseDate).toLocaleDateString()
                      : new Date(e.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`status ${statusClass[e.status]}`}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {submitting && <SubmitModal onClose={() => setSubmitting(false)} />}
      {openId && (
        <ExpenseModal id={openId} isManager={isManager} onClose={() => setOpenId(null)} />
      )}
    </AppShell>
  );
}

// ── Submit modal ──────────────────────────────────────────────────────────
function SubmitModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api.post("/expenses", {
        category,
        amount: Number(amount),
        description,
        expenseDate: expenseDate || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-summary"] });
      onClose();
    },
    onError: (err) => setError(errMsg(err, "Could not submit expense")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category.trim() || Number(amount) <= 0 || !description.trim()) {
      setError("Category, a positive amount, and description are required");
      return;
    }
    submit.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Submit expense</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Category
              <input
                list="expense-cats"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="expense-cats">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              Amount ₹
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </label>
          </div>
          <label className="stack-label">
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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

// ── Detail + approval modal ─────────────────────────────────────────────────
function ExpenseModal({
  id,
  isManager,
  onClose,
}: {
  id: string;
  isManager: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const isApprover = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: exp, isLoading } = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => (await api.get<Expense>(`/expenses/${id}`)).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expense", id] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["expense-summary"] });
  };

  const decide = useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") =>
      api.post(`/expenses/${id}/decision`, { decision, note: note || null }),
    onSuccess: invalidate,
    onError: (err) => setError(errMsg(err, "Could not record decision")),
  });

  const pay = useMutation({
    mutationFn: () => api.post(`/expenses/${id}/pay`),
    onSuccess: invalidate,
    onError: (err) => setError(errMsg(err, "Could not mark paid")),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {isLoading || !exp ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="notice-top">
              <h3>{exp.category}</h3>
              <span className={`status ${statusClassFor(exp.status)}`}>{exp.status}</span>
            </div>
            <p className="notice-body">{exp.description}</p>
            <div className="fee-summary">
              <span>Amount</span>
              <span className="pct">{money(exp.amount)}</span>
            </div>
            <p className="muted">
              Submitted by {exp.submittedBy?.email ?? "—"}
              {exp.decidedBy ? ` · decided by ${exp.decidedBy.email}` : ""}
            </p>
            {exp.decisionNote && <p className="notice-body">Note: {exp.decisionNote}</p>}

            {isManager && exp.status === "SUBMITTED" && isApprover && (
              <div className="approve-box">
                <input
                  placeholder="Decision note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="approve-actions">
                  <button
                    className="inline-btn"
                    onClick={() => decide.mutate("APPROVED")}
                    disabled={decide.isPending}
                  >
                    Approve
                  </button>
                  <button
                    className="inline-btn ghost danger-btn"
                    onClick={() => decide.mutate("REJECTED")}
                    disabled={decide.isPending}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {isManager && exp.status === "APPROVED" && (
              <div className="form-actions">
                <button className="inline-btn" onClick={() => pay.mutate()} disabled={pay.isPending}>
                  Mark paid / reimbursed
                </button>
              </div>
            )}

            {error && <p className="error">{error}</p>}

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

function statusClassFor(s: ExpenseStatus): string {
  return {
    SUBMITTED: "inv-pending",
    APPROVED: "inv-partial",
    REJECTED: "inv-cancelled",
    PAID: "inv-paid",
  }[s];
}
