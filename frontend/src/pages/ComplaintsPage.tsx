import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { SkeletonRows } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["Behaviour", "Teaching quality", "Misconduct", "Other"];

interface StaffOption {
  id: string;
  name: string;
  employeeNo: string;
}
interface Complaint {
  id: string;
  aboutStaff: string;
  employeeNo: string;
  filedBy: string;
  category: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function ComplaintsPage() {
  const { user } = useAuth();
  const canView = user?.role === "DEAN" || user?.role === "SUPER_ADMIN";
  return <AppShell title="Complaints">{canView ? <ComplaintsList /> : <FileComplaint />}</AppShell>;
}

// ── Filer view ────────────────────────────────────────────────────────────────
function FileComplaint() {
  const { data: staff } = useQuery({
    queryKey: ["complaint-staff"],
    queryFn: async () => (await api.get<{ items: StaffOption[] }>("/complaints/staff")).data.items,
  });

  const [aboutStaffId, setAboutStaffId] = useState("");
  const [category, setCategory] = useState("Behaviour");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => api.post("/complaints", { aboutStaffId, category, message, anonymous }),
    onSuccess: () => {
      setDone(true);
      setAboutStaffId("");
      setMessage("");
    },
    onError: () => setError("Could not submit complaint"),
  });

  if (done) {
    return (
      <section className="panel">
        <h3>Complaint Submitted</h3>
        <p className="muted">
          Thank you — your complaint has been sent to the Dean{anonymous ? " anonymously" : ""}.
        </p>
        <button className="inline-btn" onClick={() => setDone(false)}>
          File another
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h3>File a complaint about a staff member</h3>
      <p className="muted">Only the Dean sees complaints. You can file anonymously.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!aboutStaffId || !message.trim()) return setError("Pick a staff member and write your concern");
          submit.mutate();
        }}
      >
        <div className="form-grid">
          <label>
            Staff member
            <select value={aboutStaffId} onChange={(e) => setAboutStaffId(e.target.value)}>
              <option value="">Select…</option>
              {staff?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.employeeNo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="stack-label">
          Your concern
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Submit anonymously (your identity is not stored)
        </label>
        <div className="form-actions">
          {error && <span className="error inline">{error}</span>}
          <button type="submit" className="inline-btn" disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit complaint"}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Dean / Super-Admin view ───────────────────────────────────────────────────
function ComplaintsList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Complaint | null>(null);
  const [status, setStatus] = useState<"" | "OPEN" | "RESOLVED">("");

  const { data, isLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => (await api.get<{ items: Complaint[] }>("/complaints")).data.items,
  });

  const shown = (data ?? []).filter((c) => !status || c.status === status);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Complaints</h2>
          <p className="muted">Complaints about staff — visible only to you and the super-admin.</p>
        </div>
        <div className="controls">
          <select value={status} onChange={(e) => setStatus(e.target.value as "" | "OPEN" | "RESOLVED")}>
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>
      {isLoading && <SkeletonRows />}
      {data && shown.length === 0 && (
        <p className="muted">{status ? "No complaints with this status." : "No complaints."}</p>
      )}
      {shown.length > 0 && (
        <table className="data-table cards">
          <thead>
            <tr>
              <th>About</th>
              <th>Category</th>
              <th>Filed by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setOpen(c)}>
                <td data-label="About">{c.aboutStaff}</td>
                <td data-label="Category">{c.category}</td>
                <td data-label="Filed by">{c.filedBy}</td>
                <td data-label="Status">
                  <span className={`status ${c.status === "OPEN" ? "inv-pending" : "inv-paid"}`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <ComplaintModal
          complaint={open}
          onClose={() => setOpen(null)}
          onResolved={() => {
            qc.invalidateQueries({ queryKey: ["complaints"] });
            setOpen(null);
          }}
        />
      )}
    </>
  );
}

function ComplaintModal({
  complaint,
  onClose,
  onResolved,
}: {
  complaint: Complaint;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: () => api.post(`/complaints/${complaint.id}/resolve`, { note: note || null }),
    onSuccess: onResolved,
  });
  const c = complaint;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="notice-top">
          <h3>Complaint — {c.aboutStaff}</h3>
          <span className={`status ${c.status === "OPEN" ? "inv-pending" : "inv-paid"}`}>{c.status}</span>
        </div>
        <p className="muted">
          {c.category} · Filed by {c.filedBy} · {new Date(c.createdAt).toLocaleDateString()}
        </p>
        <p className="notice-body">{c.message}</p>
        {c.resolutionNote && <p className="notice-body">Resolution: {c.resolutionNote}</p>}

        {c.status === "OPEN" && (
          <div className="approve-box">
            <input
              placeholder="Resolution note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="approve-actions">
              <button className="inline-btn" onClick={() => resolve.mutate()} disabled={resolve.isPending}>
                Mark resolved
              </button>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="inline-btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
