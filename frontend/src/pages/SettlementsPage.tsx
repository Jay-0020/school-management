import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconWallet } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import type { Settlement, SettlementStaff, SettlementStatus } from "../lib/types";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const STATUSES: SettlementStatus[] = ["PENDING", "APPROVED", "REJECTED", "PAID"];
const statusClass: Record<SettlementStatus, string> = {
  PENDING: "inv-pending",
  APPROVED: "inv-partial",
  REJECTED: "inv-cancelled",
  PAID: "inv-paid",
};

function errMsg(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function SettlementsPage() {
  const { user } = useAuth();
  const canManage =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "DEAN";

  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settlements", status],
    queryFn: async () => {
      const params = status ? { status } : {};
      return (await api.get<{ items: Settlement[] }>("/settlements", { params })).data.items;
    },
  });

  return (
    <AppShell title="Settlements">
      <div className="page-head">
        <h2>Full &amp; Final Settlements</h2>
        <div className="controls">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {canManage && (
            <button className="inline-btn" onClick={() => setCreating(true)}>
              + New settlement
            </button>
          )}
        </div>
      </div>

      {isLoading && <SkeletonRows />}
      {data && data.length === 0 && (
        <EmptyState
          icon={IconWallet}
          title="No settlements"
          hint="Create a full & final settlement when a staff member leaves."
        />
      )}

      {data && data.length > 0 && (
        <table className="data-table cards">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Last working day</th>
              <th>Net payable</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpenId(s.id)}>
                <td data-label="Staff">
                  {s.teacher.firstName} {s.teacher.lastName}
                  <span className="muted"> · {s.teacher.employeeNo}</span>
                </td>
                <td data-label="Last working day">{s.lastWorkingDay ? new Date(s.lastWorkingDay).toLocaleDateString() : "—"}</td>
                <td data-label="Net payable">{money(s.netPayable)}</td>
                <td data-label="Status">
                  <span className={`status ${statusClass[s.status]}`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} />}
      {openId && (
        <DetailModal
          settlement={data!.find((x) => x.id === openId)!}
          canManage={canManage}
          onClose={() => setOpenId(null)}
        />
      )}
    </AppShell>
  );
}

// ── Create ────────────────────────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [teacherId, setTeacherId] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [bonus, setBonus] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: staff } = useQuery({
    queryKey: ["settlement-staff"],
    queryFn: async () => (await api.get<{ items: SettlementStaff[] }>("/settlements/staff")).data.items,
  });

  const selected = useMemo(() => staff?.find((s) => s.id === teacherId), [staff, teacherId]);
  const pending = selected?.pendingSalary ?? 0;
  const net = pending + (Number(bonus) || 0) - (Number(deductions) || 0);

  const submit = useMutation({
    mutationFn: () =>
      api.post("/settlements", {
        teacherId,
        lastWorkingDay: lastWorkingDay || null,
        bonus: Number(bonus) || 0,
        deductions: Number(deductions) || 0,
        notes: notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settlements"] });
      onClose();
    },
    onError: (err) => setError(errMsg(err, "Could not create settlement")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!teacherId) return setError("Select a staff member");
    submit.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New full &amp; final settlement</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Staff member
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Select…</option>
                {staff?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.employeeNo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Last working day
              <input
                type="date"
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
              />
            </label>
            <label>
              Gratuity / bonus ₹
              <input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
            </label>
            <label>
              Deductions ₹
              <input
                type="number"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </label>
          </div>

          <label className="stack-label">
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="settle-breakdown">
            <div>
              <span>Pending salary</span>
              <strong>{money(pending)}</strong>
            </div>
            <div>
              <span>+ Bonus</span>
              <strong>{money(Number(bonus) || 0)}</strong>
            </div>
            <div>
              <span>− Deductions</span>
              <strong>{money(Number(deductions) || 0)}</strong>
            </div>
            <div className="settle-net">
              <span>Net payable</span>
              <strong>{money(net)}</strong>
            </div>
          </div>

          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="inline-btn" disabled={submit.isPending}>
              {submit.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail + decision / pay ──────────────────────────────────────────────────
function DetailModal({
  settlement,
  canManage,
  onClose,
}: {
  settlement: Settlement;
  canManage: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const canPay =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["settlements"] });

  const decide = useMutation({
    mutationFn: (decision: "APPROVED" | "REJECTED") =>
      api.post(`/settlements/${settlement.id}/decision`, { decision, note: note || null }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(errMsg(err, "Could not record decision")),
  });

  const pay = useMutation({
    mutationFn: () => api.post(`/settlements/${settlement.id}/pay`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(errMsg(err, "Could not mark paid")),
  });

  const s = settlement;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="notice-top">
          <h3>
            {s.teacher.firstName} {s.teacher.lastName}
          </h3>
          <span className={`status ${statusClass[s.status]}`}>{s.status}</span>
        </div>
        <p className="muted">
          {s.teacher.employeeNo} · {s.teacher.staffType === "TEACHING" ? "Teaching" : "Non-teaching"}
          {s.lastWorkingDay ? ` · Last day ${new Date(s.lastWorkingDay).toLocaleDateString()}` : ""}
        </p>

        <div className="settle-breakdown">
          <div>
            <span>Pending salary</span>
            <strong>{money(s.pendingSalary)}</strong>
          </div>
          <div>
            <span>+ Bonus</span>
            <strong>{money(s.bonus)}</strong>
          </div>
          <div>
            <span>− Deductions</span>
            <strong>{money(s.deductions)}</strong>
          </div>
          <div className="settle-net">
            <span>Net payable</span>
            <strong>{money(s.netPayable)}</strong>
          </div>
        </div>

        {s.notes && <p className="notice-body">Notes: {s.notes}</p>}
        {s.decisionNote && <p className="notice-body">Decision: {s.decisionNote}</p>}

        {canManage && s.status === "PENDING" && (
          <div className="approve-box">
            <input
              placeholder="Decision note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="approve-actions">
              <button className="inline-btn" onClick={() => decide.mutate("APPROVED")} disabled={decide.isPending}>
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

        {canPay && s.status === "APPROVED" && (
          <div className="form-actions">
            <button className="inline-btn" onClick={() => pay.mutate()} disabled={pay.isPending}>
              Mark paid
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button className="inline-btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
