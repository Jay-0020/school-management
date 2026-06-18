import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { downloadPdf } from "../lib/download";
import { toast } from "../lib/toast";
import type {
  ClassWithSections,
  FeeStructure,
  Invoice,
  InvoiceDetail,
  InvoiceStatus,
  PaymentMethod,
} from "../lib/types";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const STATUSES: InvoiceStatus[] = ["PENDING", "PARTIAL", "PAID", "CANCELLED"];
const METHODS: PaymentMethod[] = [
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
  "ONLINE",
  "OTHER",
];

function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}

interface OnlineConfig {
  enabled: boolean;
  keyId: string | null;
  feePercent: number;
}
interface OnlineOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  invoiceTitle: string;
  outstanding: number;
  surcharge: number;
  gross: number;
  prefill: { name?: string; email?: string; contact?: string };
}

// Load Razorpay Checkout on demand (only when a parent actually pays).
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function FeesPage() {
  const { user } = useAuth();
  const isManager =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "ACCOUNTANT";
  const [tab, setTab] = useState<"invoices" | "structures">("invoices");

  return (
    <AppShell title="Fees">
        <h2>{isManager ? "Fees" : "My Fees"}</h2>

        {isManager ? (
          <>
            <div className="tabs">
              <button
                className={`tab ${tab === "invoices" ? "active" : ""}`}
                onClick={() => setTab("invoices")}
              >
                Invoices
              </button>
              <button
                className={`tab ${tab === "structures" ? "active" : ""}`}
                onClick={() => setTab("structures")}
              >
                Fee Structures
              </button>
            </div>
            {tab === "invoices" ? <InvoicesTab manager /> : <StructuresTab />}
          </>
        ) : (
          <InvoicesTab manager={false} />
        )}
    </AppShell>
  );
}

// ── Fee structures ──────────────────────────────────────────────────────────
function StructuresTab() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
  });

  // Default to first class.
  if (!classId && classes && classes.length) setClassId(classes[0].id);

  const { data: structures } = useQuery({
    queryKey: ["fee-structures", classId],
    queryFn: async () =>
      (await api.get<{ items: FeeStructure[] }>("/fees/structures", { params: { classId } }))
        .data.items,
    enabled: !!classId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["fee-structures", classId] });

  const add = useMutation({
    mutationFn: () =>
      api.post("/fees/structures", { classId, name, amount: Number(amount) }),
    onSuccess: () => {
      setName("");
      setAmount("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errMsg(err, "Could not add fee")),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/fees/structures/${id}`),
    onSuccess: invalidate,
  });

  const total = (structures ?? []).reduce((s, f) => s + f.amount, 0);

  return (
    <section className="panel">
      <div className="mark-controls">
        <label className="inline-field">
          Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && Number(amount) > 0) add.mutate();
        }}
      >
        <input
          placeholder="Fee head (e.g. Tuition - Term 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount ₹"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ maxWidth: 140 }}
        />
        <button className="inline-btn" type="submit" disabled={add.isPending || !classId}>
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {structures && structures.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fee head</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {structures.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{money(f.amount)}</td>
                <td>
                  <button className="link danger" onClick={() => del.mutate(f.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total per student</strong>
              </td>
              <td>
                <strong>{money(total)}</strong>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="muted">No fee heads for this class yet.</p>
      )}
    </section>
  );
}

// ── Invoices ────────────────────────────────────────────────────────────────
function InvoicesTab({ manager }: { manager: boolean }) {
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
    enabled: manager,
  });
  const sectionOptions = useMemo(
    () =>
      (classes ?? []).flatMap((c) =>
        c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))
      ),
    [classes]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", sectionId, status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (sectionId) params.sectionId = sectionId;
      if (status) params.status = status;
      return (await api.get<{ items: Invoice[] }>("/fees/invoices", { params })).data.items;
    },
  });

  return (
    <section className="panel">
      {manager && (
        <div className="page-head">
          <div className="controls">
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All sections</option>
              {sectionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button className="inline-btn" onClick={() => setGenerating(true)}>
            + Generate invoices
          </button>
        </div>
      )}

      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && <p className="muted">No invoices.</p>}

      {data && data.length > 0 && (
        <table className="data-table cards">
          <thead>
            <tr>
              {manager && <th>Student</th>}
              <th>Title</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((inv) => (
              <tr
                key={inv.id}
                className="clickable"
                onClick={() => setOpenId(inv.id)}
              >
                {manager && (
                  <td data-label="Student">
                    {inv.student?.firstName} {inv.student?.lastName}
                    <span className="muted"> ({inv.student?.admissionNo})</span>
                  </td>
                )}
                <td data-label="Title">{inv.title}</td>
                <td data-label="Total">{money(inv.total)}</td>
                <td data-label="Paid">{money(inv.amountPaid)}</td>
                <td data-label="Balance">{money(inv.total - inv.amountPaid)}</td>
                <td data-label="Due">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                <td data-label="Status">
                  <span className={`status inv-${inv.status.toLowerCase()}`}>{inv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {generating && <GenerateModal classes={classes ?? []} onClose={() => setGenerating(false)} />}
      {openId && (
        <InvoiceModal id={openId} manager={manager} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}

// ── Generate invoices modal ─────────────────────────────────────────────────
function GenerateModal({
  classes,
  onClose,
}: {
  classes: ClassWithSections[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () =>
      api.post<{ created: number; skipped: number; total: number }>("/fees/invoices/generate", {
        classId,
        title,
        dueDate: dueDate || null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setResult(
        `Created ${res.data.created} invoice(s) of ${money(res.data.total)} each` +
          (res.data.skipped ? `, skipped ${res.data.skipped} existing` : "")
      );
    },
    onError: (err) => setError(errMsg(err, "Could not generate invoices")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    gen.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Generate Invoices</h3>
        <p className="muted hint">
          Creates one invoice per active student in the class, using that class's fee structure.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Class
              <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
          <label className="stack-label">
            Title
            <input
              placeholder="e.g. Term 1 Fees 2026-27"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            {result && <span className="ok inline">{result}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>
              {result ? "Close" : "Cancel"}
            </button>
            <button type="submit" className="inline-btn" disabled={gen.isPending}>
              {gen.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invoice detail + record payment ─────────────────────────────────────────
function InvoiceModal({
  id,
  manager,
  onClose,
}: {
  id: string;
  manager: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => (await api.get<InvoiceDetail>(`/fees/invoices/${id}`)).data,
  });

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const balance = inv ? inv.total - inv.amountPaid : 0;

  // Whether to offer "Pay online" (students/parents only).
  const { data: payCfg } = useQuery({
    queryKey: ["online-config"],
    queryFn: async () => (await api.get<OnlineConfig>("/fees/online/config")).data,
    enabled: !manager,
  });

  const surcharge = payCfg ? Math.round((balance * payCfg.feePercent) / 100) : 0;
  const grossOnline = balance + surcharge;

  async function startOnlinePay() {
    if (!inv) return;
    setError(null);
    setPaying(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Couldn't load the payment window. Check your connection and try again.");
      const { data: order } = await api.post<OnlineOrder>(`/fees/invoices/${id}/online-order`, {});
      const rzp = new (window as unknown as { Razorpay: new (o: unknown) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }).Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.invoiceTitle,
        description: `Fee payment — ${order.invoiceTitle}`,
        prefill: order.prefill,
        theme: { color: "#1d4ed8" },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api.post(`/fees/invoices/${id}/online-verify`, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success("Payment successful 🎉");
          } catch {
            // The webhook will still settle it; just let them know it's processing.
            toast.success("Payment received — your balance will update shortly.");
          }
          qc.invalidateQueries({ queryKey: ["invoice", id] });
          qc.invalidateQueries({ queryKey: ["invoices"] });
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on("payment.failed", (r) => {
        const desc = (r as { error?: { description?: string } })?.error?.description;
        setError(desc ?? "Payment failed. Please try again.");
      });
      rzp.open();
    } catch (e) {
      setError(errMsg(e, "Could not start payment"));
    } finally {
      setPaying(false);
    }
  }

  const pay = useMutation({
    mutationFn: () =>
      api.post(`/fees/invoices/${id}/payments`, {
        amount: Number(amount),
        method,
        reference: reference || null,
      }),
    onSuccess: () => {
      setAmount("");
      setReference("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => setError(errMsg(err, "Could not record payment")),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {isLoading || !inv ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="notice-top">
              <h3>{inv.title}</h3>
              <span className={`status inv-${inv.status.toLowerCase()}`}>{inv.status}</span>
            </div>
            {inv.student && (
              <p className="muted">
                {inv.student.firstName} {inv.student.lastName} ({inv.student.admissionNo})
              </p>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td>{money(it.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{money(inv.total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="fee-summary">
              <span>Paid: {money(inv.amountPaid)}</span>
              <span className={balance > 0 ? "pct-low" : "pct"}>
                Balance: {money(balance)}
              </span>
            </div>

            <h4>Payments</h4>
            {inv.payments.length === 0 ? (
              <p className="muted">No payments recorded.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.paidAt).toLocaleDateString()}</td>
                      <td>{money(p.amount)}</td>
                      <td>{p.method}</td>
                      <td>{p.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {manager && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
              <form
                className="pay-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (Number(amount) > 0) pay.mutate();
                }}
              >
                <input
                  type="number"
                  placeholder={`Amount (≤ ${balance})`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Reference (optional)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
                <button className="inline-btn" type="submit" disabled={pay.isPending}>
                  Record
                </button>
              </form>
            )}
            {!manager && balance > 0 && inv.status !== "CANCELLED" && payCfg?.enabled && (
              <div className="pay-online" style={{ marginTop: 12 }}>
                <p className="muted" style={{ marginBottom: 8 }}>
                  {money(balance)} fee + {money(surcharge)} processing ({payCfg.feePercent}%) ={" "}
                  <strong>{money(grossOnline)}</strong>
                </p>
                <button className="inline-btn" disabled={paying} onClick={startOnlinePay}>
                  {paying ? "Opening…" : `Pay ${money(grossOnline)} online`}
                </button>
              </div>
            )}
            {error && <p className="error">{error}</p>}

            <div className="form-actions">
              <button
                className="inline-btn ghost"
                onClick={() => downloadPdf(`/fees/invoices/${id}/pdf`, `fees-${id.slice(-6)}.pdf`)}
              >
                Download PDF
              </button>
              <button className="inline-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
