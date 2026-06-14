import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import type {
  Payslip,
  SalaryStructure,
  StaffWithStructure,
} from "../lib/types";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const monthStr = () => new Date().toISOString().slice(0, 7);

function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}

// Mirrors the backend computation for live previews.
function preview(s: SalaryStructure) {
  const gross = s.basic + s.hra + s.da + s.conveyance + s.specialAllowance;
  const pf = s.pfApplicable ? Math.round(0.12 * Math.min(s.basic, 15000)) : 0;
  const esi = s.esiApplicable && gross <= 21000 ? Math.ceil(0.0075 * gross) : 0;
  const deductions = pf + esi + s.professionalTax + s.tdsMonthly;
  return { gross, net: gross - deductions };
}

export function PayrollPage() {
  const { user } = useAuth();
  const isManager =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  const [tab, setTab] = useState<"payslips" | "structures">("payslips");

  return (
    <div className="app-shell">
      <PageHeader title="Payroll" />
      <main className="content">
        <h2>{isManager ? "Payroll" : "My Payslips"}</h2>

        {isManager ? (
          <>
            <div className="tabs">
              <button
                className={`tab ${tab === "payslips" ? "active" : ""}`}
                onClick={() => setTab("payslips")}
              >
                Payslips
              </button>
              <button
                className={`tab ${tab === "structures" ? "active" : ""}`}
                onClick={() => setTab("structures")}
              >
                Salary structures
              </button>
            </div>
            {tab === "payslips" ? <PayslipsTab manager /> : <StructuresTab />}
          </>
        ) : (
          <PayslipsTab manager={false} />
        )}
      </main>
    </div>
  );
}

// ── Salary structures ───────────────────────────────────────────────────────
function StructuresTab() {
  const [editing, setEditing] = useState<StaffWithStructure | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["salary-structures"],
    queryFn: async () =>
      (await api.get<{ items: StaffWithStructure[] }>("/payroll/structures")).data.items,
  });

  return (
    <section className="panel">
      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && <p className="muted">No active staff.</p>}

      {data && data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Emp. No</th>
              <th>Name</th>
              <th>Basic</th>
              <th>Gross</th>
              <th>Net</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => {
              const p = s.salaryStructure ? preview(s.salaryStructure) : null;
              return (
                <tr key={s.id}>
                  <td>{s.employeeNo}</td>
                  <td>
                    {s.firstName} {s.lastName}
                  </td>
                  <td>{s.salaryStructure ? money(s.salaryStructure.basic) : "—"}</td>
                  <td>{p ? money(p.gross) : "—"}</td>
                  <td>{p ? money(p.net) : "—"}</td>
                  <td>
                    <button className="link" onClick={() => setEditing(s)}>
                      {s.salaryStructure ? "Edit" : "Set"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && <StructureModal staff={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

type StructForm = {
  basic: string;
  hra: string;
  da: string;
  conveyance: string;
  specialAllowance: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTax: string;
  tdsMonthly: string;
};

function StructureModal({
  staff,
  onClose,
}: {
  staff: StaffWithStructure;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const s = staff.salaryStructure;
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StructForm>({
    basic: String(s?.basic ?? ""),
    hra: String(s?.hra ?? 0),
    da: String(s?.da ?? 0),
    conveyance: String(s?.conveyance ?? 0),
    specialAllowance: String(s?.specialAllowance ?? 0),
    pfApplicable: s?.pfApplicable ?? true,
    esiApplicable: s?.esiApplicable ?? false,
    professionalTax: String(s?.professionalTax ?? 0),
    tdsMonthly: String(s?.tdsMonthly ?? 0),
  });

  function set<K extends keyof StructForm>(key: K, value: StructForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const live = preview({
    basic: Number(form.basic) || 0,
    hra: Number(form.hra) || 0,
    da: Number(form.da) || 0,
    conveyance: Number(form.conveyance) || 0,
    specialAllowance: Number(form.specialAllowance) || 0,
    pfApplicable: form.pfApplicable,
    esiApplicable: form.esiApplicable,
    professionalTax: Number(form.professionalTax) || 0,
    tdsMonthly: Number(form.tdsMonthly) || 0,
  } as SalaryStructure);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/payroll/structures/${staff.id}`, {
        basic: Number(form.basic) || 0,
        hra: Number(form.hra) || 0,
        da: Number(form.da) || 0,
        conveyance: Number(form.conveyance) || 0,
        specialAllowance: Number(form.specialAllowance) || 0,
        pfApplicable: form.pfApplicable,
        esiApplicable: form.esiApplicable,
        professionalTax: Number(form.professionalTax) || 0,
        tdsMonthly: Number(form.tdsMonthly) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-structures"] });
      onClose();
    },
    onError: (err) => setError(errMsg(err, "Could not save structure")),
  });

  function num(label: string, key: keyof StructForm) {
    return (
      <label>
        {label}
        <input
          type="number"
          value={form[key] as string}
          onChange={(e) => set(key, e.target.value as StructForm[typeof key])}
        />
      </label>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.basic || Number(form.basic) <= 0) {
      setError("Basic pay is required");
      return;
    }
    save.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          Salary — {staff.firstName} {staff.lastName}
        </h3>
        <form onSubmit={handleSubmit}>
          <p className="muted hint">Earnings (monthly ₹)</p>
          <div className="form-grid">
            {num("Basic", "basic")}
            {num("HRA", "hra")}
            {num("DA", "da")}
            {num("Conveyance", "conveyance")}
            {num("Special allowance", "specialAllowance")}
          </div>

          <p className="muted hint">Deductions</p>
          <div className="form-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.pfApplicable}
                onChange={(e) => set("pfApplicable", e.target.checked)}
              />
              PF (12% of basic, ₹15k cap)
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.esiApplicable}
                onChange={(e) => set("esiApplicable", e.target.checked)}
              />
              ESI (0.75%, gross ≤ ₹21k)
            </label>
            {num("Professional Tax", "professionalTax")}
            {num("TDS (monthly)", "tdsMonthly")}
          </div>

          <div className="fee-summary">
            <span>Gross: {money(live.gross)}</span>
            <span className="pct">Net: {money(live.net)}</span>
          </div>

          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="inline-btn" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Payslips ────────────────────────────────────────────────────────────────
function PayslipsTab({ manager }: { manager: boolean }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthStr());
  const [openId, setOpenId] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["payslips", manager ? month : "mine"],
    queryFn: async () => {
      const params = manager ? { month } : {};
      return (await api.get<{ items: Payslip[] }>("/payroll/payslips", { params })).data.items;
    },
  });

  const run = useMutation({
    mutationFn: () =>
      api.post<{ created: number; skipped: number }>("/payroll/run", { month }),
    onSuccess: (res) => {
      setRunErr(null);
      setRunMsg(
        `Generated ${res.data.created} payslip(s)` +
          (res.data.skipped ? `, skipped ${res.data.skipped} existing` : "")
      );
      qc.invalidateQueries({ queryKey: ["payslips", month] });
    },
    onError: (err) => {
      setRunMsg(null);
      setRunErr(errMsg(err, "Could not run payroll"));
    },
  });

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/payslips/${id}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payslips", month] }),
  });

  return (
    <section className="panel">
      {manager && (
        <div className="page-head">
          <label className="inline-field">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <button className="inline-btn" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "Running…" : "Run payroll"}
          </button>
        </div>
      )}
      {runMsg && <p className="ok">{runMsg}</p>}
      {runErr && <p className="error">{runErr}</p>}

      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && (
        <p className="muted">{manager ? "No payslips for this month." : "No payslips yet."}</p>
      )}

      {data && data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              {manager && <th>Staff</th>}
              {!manager && <th>Month</th>}
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net</th>
              <th>Status</th>
              {manager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => setOpenId(p.id)}>
                {manager && (
                  <td>
                    {p.teacher?.firstName} {p.teacher?.lastName}
                    <span className="muted"> ({p.teacher?.employeeNo})</span>
                  </td>
                )}
                {!manager && <td>{p.month}</td>}
                <td>{money(p.gross)}</td>
                <td>{money(p.totalDeductions)}</td>
                <td>{money(p.net)}</td>
                <td>
                  <span className={`status inv-${p.status === "PAID" ? "paid" : "pending"}`}>
                    {p.status}
                  </span>
                </td>
                {manager && (
                  <td onClick={(e) => e.stopPropagation()}>
                    {p.status !== "PAID" && (
                      <button className="link" onClick={() => pay.mutate(p.id)}>
                        Mark paid
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId && <PayslipModal id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function PayslipModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: p, isLoading } = useQuery({
    queryKey: ["payslip", id],
    queryFn: async () => (await api.get<Payslip>(`/payroll/payslips/${id}`)).data,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {isLoading || !p ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="notice-top">
              <h3>
                Payslip — {p.month}
                {p.teacher ? ` · ${p.teacher.firstName} ${p.teacher.lastName}` : ""}
              </h3>
              <span className={`status inv-${p.status === "PAID" ? "paid" : "pending"}`}>
                {p.status}
              </span>
            </div>

            <table className="data-table">
              <tbody>
                <tr><td>Basic</td><td>{money(p.basic)}</td></tr>
                <tr><td>HRA</td><td>{money(p.hra)}</td></tr>
                <tr><td>DA</td><td>{money(p.da)}</td></tr>
                <tr><td>Conveyance</td><td>{money(p.conveyance)}</td></tr>
                <tr><td>Special allowance</td><td>{money(p.specialAllowance)}</td></tr>
                <tr><td><strong>Gross</strong></td><td><strong>{money(p.gross)}</strong></td></tr>
                <tr><td>PF</td><td>− {money(p.pf)}</td></tr>
                <tr><td>ESI</td><td>− {money(p.esi)}</td></tr>
                <tr><td>Professional Tax</td><td>− {money(p.professionalTax)}</td></tr>
                <tr><td>TDS</td><td>− {money(p.tds)}</td></tr>
                <tr><td><strong>Total deductions</strong></td><td><strong>− {money(p.totalDeductions)}</strong></td></tr>
              </tbody>
            </table>

            <div className="fee-summary">
              <span>Net pay</span>
              <span className="pct">{money(p.net)}</span>
            </div>

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
