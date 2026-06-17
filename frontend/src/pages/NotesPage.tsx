import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconBook } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { downloadFile } from "../lib/download";
import { toast } from "../lib/toast";
import type { ClassWithSections, NoteStatus, SharedNote, Subject } from "../lib/types";

const statusClass: Record<NoteStatus, string> = {
  PENDING: "inv-pending",
  APPROVED: "inv-paid",
  REJECTED: "inv-cancelled",
};
const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const errMsg = (e: unknown, f: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;

export function NotesPage() {
  const { user } = useAuth();
  const isStaff =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "TEACHER";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notes", status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (isStaff && status) params.status = status;
      return (await api.get<{ items: SharedNote[] }>("/notes", { params })).data.items;
    },
  });

  const filtered = useMemo(
    () => (data ?? []).filter((n) => n.title.toLowerCase().includes(q.toLowerCase())),
    [data, q]
  );

  const moderate = useMutation({
    mutationFn: (v: { id: string; decision: "APPROVED" | "REJECTED" }) =>
      api.post(`/notes/${v.id}/moderate`, { decision: v.decision }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success(v.decision === "APPROVED" ? "Note approved" : "Note rejected");
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
    },
  });

  function canDelete(n: SharedNote) {
    return (
      user?.role === "ADMIN" ||
      user?.role === "SUPER_ADMIN" ||
      n.uploadedBy?.id === user?.id
    );
  }

  return (
    <AppShell title="Study Notes">
      <div className="page-head">
        <h2>Study Notes</h2>
        <div className="controls">
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
          {isStaff && (
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}
          <button className="inline-btn" onClick={() => setUploading(true)}>+ Upload notes</button>
        </div>
      </div>

      {isLoading && <SkeletonRows />}
      {data && filtered.length === 0 && (
        <EmptyState icon={IconBook} title="No notes yet" hint="Upload study notes to share them with your class or the whole school." />
      )}
      {filtered.length > 0 && (
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Subject</th><th>Shared with</th><th>By</th><th>Size</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((n) => (
              <tr key={n.id}>
                <td>{n.title}</td>
                <td>{n.subject?.name ?? "—"}</td>
                <td>{n.section ? `${n.section.class.name} · ${n.section.name}` : "School-wide"}</td>
                <td>{n.uploadedBy?.email ?? "—"}</td>
                <td>{fmtSize(n.size)}</td>
                <td><span className={`status ${statusClass[n.status]}`}>{n.status}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="link" onClick={() => downloadFile(`/notes/${n.id}/download`, n.originalName).catch(() => toast.error("Download failed"))}>
                      Download
                    </button>
                    {isStaff && n.status === "PENDING" && (
                      <>
                        <button className="link" onClick={() => moderate.mutate({ id: n.id, decision: "APPROVED" })}>Approve</button>
                        <button className="link danger" onClick={() => moderate.mutate({ id: n.id, decision: "REJECTED" })}>Reject</button>
                      </>
                    )}
                    {canDelete(n) && (
                      <button className="link danger" onClick={() => { if (confirm("Delete this note?")) del.mutate(n.id); }}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {uploading && <UploadModal onClose={() => setUploading(false)} />}
    </AppShell>
  );
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await api.get<{ items: Subject[] }>("/schoolwork/subjects")).data.items,
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-notes"],
    queryFn: async () => {
      try { return (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items; }
      catch { return []; } // students can't list classes; they share school-wide
    },
  });
  const sectionOptions = useMemo(
    () => (classes ?? []).flatMap((c) => c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))),
    [classes]
  );

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("title", title);
      if (description) fd.append("description", description);
      if (subjectId) fd.append("subjectId", subjectId);
      if (sectionId) fd.append("sectionId", sectionId);
      fd.append("file", file!);
      return api.post("/notes", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Notes uploaded");
      onClose();
    },
    onError: (e) => setError(errMsg(e, "Could not upload")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required");
    if (!file) return setError("Please choose a file");
    upload.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Upload notes</h3>
        <form onSubmit={submit}>
          <label className="stack-label">Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="stack-label">Description
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="form-grid">
            <label>Subject
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">None</option>
                {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {sectionOptions.length > 0 && (
              <label>Share with
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                  <option value="">School-wide</option>
                  {sectionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className="stack-label">File (PDF, image, doc — max 10 MB)
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="inline-btn" disabled={upload.isPending}>
              {upload.isPending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
