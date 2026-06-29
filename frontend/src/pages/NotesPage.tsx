import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconBook } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { downloadFile } from "../lib/download";
import { toast } from "../lib/toast";
import type { ClassWithSections, SharedNote, Subject } from "../lib/types";

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const errMsg = (e: unknown, f: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? f;

const PAGE_SIZE = 25;
const UPLOADER_ROLES = ["SUPER_ADMIN", "ADMIN", "DEAN", "TEACHER"];
type TeacherLite = { id: string; firstName: string; lastName: string; userId: string | null };

export function NotesPage() {
  const { user } = useAuth();
  const canUpload = !!user && UPLOADER_ROLES.includes(user.role);
  const isStaff = canUpload; // same set decides who sees the staff-only filters
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [type, setType] = useState("");
  const [uploadedById, setUploadedById] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);

  // Debounce the search box (server-side search).
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 whenever a filter changes.
  function onFilter<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notes", { debouncedQ, subjectId, sectionId, type, uploadedById, page }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
      if (debouncedQ) params.q = debouncedQ;
      if (subjectId) params.subjectId = subjectId;
      if (sectionId) params.sectionId = sectionId;
      if (type) params.type = type;
      if (uploadedById) params.uploadedById = uploadedById;
      return (await api.get<{ items: SharedNote[]; total: number }>("/notes", { params })).data;
    },
  });

  // Filter option sources.
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await api.get<{ items: Subject[] }>("/schoolwork/subjects")).data.items,
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-notes"],
    enabled: isStaff,
    queryFn: async () => {
      try { return (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items; }
      catch { return []; }
    },
  });
  const sectionOptions = useMemo(
    () => (classes ?? []).flatMap((c) => c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))),
    [classes]
  );
  const { data: teachers } = useQuery({
    queryKey: ["teachers-notes"],
    enabled: isStaff,
    queryFn: async () => {
      try { return (await api.get<{ items: TeacherLite[] }>("/teachers", { params: { pageSize: 100 } })).data.items; }
      catch { return []; }
    },
  });
  const teacherOptions = (teachers ?? []).filter((t) => t.userId);

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); toast.success("Note deleted"); },
    onError: (e) => toast.error(errMsg(e, "Could not delete")),
  });

  const canDelete = (n: SharedNote) =>
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || n.uploadedBy?.id === user?.id;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell title="Study Notes">
      <div className="page-head">
        <h2>Study Notes</h2>
        <div className="controls">
          <input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 180 }} />
          <select value={subjectId} onChange={(e) => onFilter(setSubjectId)(e.target.value)}>
            <option value="">All subjects</option>
            {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={type} onChange={(e) => onFilter(setType)(e.target.value)}>
            <option value="">All types</option>
            <option value="pdf">PDF</option>
            <option value="image">Image</option>
            <option value="doc">Document</option>
          </select>
          {isStaff && sectionOptions.length > 0 && (
            <select value={sectionId} onChange={(e) => onFilter(setSectionId)(e.target.value)}>
              <option value="">All classes</option>
              {sectionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
          {isStaff && teacherOptions.length > 0 && (
            <select value={uploadedById} onChange={(e) => onFilter(setUploadedById)(e.target.value)}>
              <option value="">All teachers</option>
              {teacherOptions.map((t) => <option key={t.id} value={t.userId!}>{t.firstName} {t.lastName}</option>)}
            </select>
          )}
          {canUpload && <button className="inline-btn" onClick={() => setUploading(true)}>+ Upload notes</button>}
        </div>
      </div>

      {isLoading && <SkeletonRows />}
      {isError && <EmptyState icon={IconBook} title="Couldn't load notes" hint="Please try again." />}
      {data && items.length === 0 && (
        <EmptyState
          icon={IconBook}
          title="No notes found"
          hint={canUpload ? "Upload study notes to share them with a class or the whole school." : "No notes match your filters yet."}
        />
      )}
      {items.length > 0 && (
        <>
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Subject</th><th>Shared with</th><th>By</th><th>Size</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id}>
                  <td>{n.title}</td>
                  <td>{n.subject?.name ?? "—"}</td>
                  <td>{n.section ? `${n.section.class.name} · ${n.section.name}` : "School-wide"}</td>
                  <td>{n.uploadedBy?.email ?? "—"}</td>
                  <td>{fmtSize(n.size)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="link" onClick={() => downloadFile(`/notes/${n.id}/download`, n.originalName).catch(() => toast.error("Download failed"))}>
                        Download
                      </button>
                      {canDelete(n) && (
                        <button className="link danger" onClick={() => { if (confirm("Delete this note?")) del.mutate(n.id); }}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="pager">
              <button className="inline-btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span className="muted">Page {page} of {pages} · {total} notes</span>
              <button className="inline-btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
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
      catch { return []; }
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

  const MAX_BYTES = 10 * 1024 * 1024;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required");
    if (!file) return setError("Please choose a file");
    if (file.size > MAX_BYTES) return setError("File is larger than 10 MB");
    upload.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Upload Notes</h3>
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
