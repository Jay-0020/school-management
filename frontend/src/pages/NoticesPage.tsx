import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import type { ClassWithSections, Notice, NoticeAudience } from "../lib/types";

const AUDIENCES: NoticeAudience[] = ["ALL", "STUDENTS", "STAFF", "SECTION"];
const AUDIENCE_LABEL: Record<NoticeAudience, string> = {
  ALL: "Everyone",
  STUDENTS: "Students",
  STAFF: "Staff",
  SECTION: "Section",
};

interface SectionOption {
  id: string;
  label: string;
}

export function NoticesPage() {
  const { user } = useAuth();
  const isManager =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "TEACHER";

  const [editing, setEditing] = useState<Notice | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
    enabled: isManager,
  });
  const sectionOptions: SectionOption[] = useMemo(
    () =>
      (classes ?? []).flatMap((c) =>
        c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))
      ),
    [classes]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => (await api.get<{ items: Notice[] }>("/notices")).data.items,
  });

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });

  function canManage(n: Notice) {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    return n.authorId === user.id; // teachers: own notices only
  }

  return (
    <AppShell title="Notices">
        <div className="page-head">
          <h2>Notices</h2>
          {isManager && (
            <div className="controls">
              <button className="inline-btn" onClick={() => setCreating(true)}>
                + New notice
              </button>
            </div>
          )}
        </div>

        {isLoading && <p className="muted">Loading…</p>}
        {data && data.length === 0 && (
          <div className="panel">
            <p className="muted">No notices yet.</p>
          </div>
        )}

        <div className="notice-list">
          {data?.map((n) => (
            <article className={`notice-card ${n.pinned ? "pinned" : ""}`} key={n.id}>
              <div className="notice-top">
                <h3>
                  {n.pinned && <span className="pin">📌</span>}
                  {n.title}
                </h3>
                <span className="audience-badge">
                  {n.audience === "SECTION" && n.section
                    ? `${n.section.class.name} · ${n.section.name}`
                    : AUDIENCE_LABEL[n.audience]}
                </span>
              </div>
              <p className="notice-body">{n.body}</p>
              <div className="notice-foot">
                <span className="muted">
                  {n.author?.email ?? "—"} ·{" "}
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
                {canManage(n) && (
                  <span className="notice-actions">
                    <button className="link" onClick={() => setEditing(n)}>
                      Edit
                    </button>
                    <button
                      className="link danger"
                      onClick={() => {
                        if (confirm("Delete this notice?")) del.mutate(n.id);
                      }}
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      {(creating || editing) && (
        <NoticeModal
          notice={editing}
          sectionOptions={sectionOptions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

// ── Create / edit modal ─────────────────────────────────────────────────────
type FormState = {
  title: string;
  body: string;
  audience: NoticeAudience;
  sectionId: string;
  pinned: boolean;
};

function NoticeModal({
  notice,
  sectionOptions,
  onClose,
}: {
  notice: Notice | null;
  sectionOptions: SectionOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!notice;
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    title: notice?.title ?? "",
    body: notice?.body ?? "",
    audience: notice?.audience ?? "ALL",
    sectionId: notice?.sectionId ?? "",
    pinned: notice?.pinned ?? false,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        body: form.body,
        audience: form.audience,
        sectionId: form.audience === "SECTION" ? form.sectionId || null : null,
        pinned: form.pinned,
      };
      return isEdit
        ? api.patch(`/notices/${notice!.id}`, payload)
        : api.post("/notices", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not save notice";
      setError(message);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.audience === "SECTION" && !form.sectionId) {
      setError("Pick a section for a section-targeted notice");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Edit notice" : "New notice"}</h3>
        <form onSubmit={handleSubmit}>
          <label className="stack-label">
            Title
            <input value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </label>
          <label className="stack-label">
            Message
            <textarea
              rows={5}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Audience
              <select
                value={form.audience}
                onChange={(e) => set("audience", e.target.value as NoticeAudience)}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
            {form.audience === "SECTION" && (
              <label>
                Section
                <select
                  value={form.sectionId}
                  onChange={(e) => set("sectionId", e.target.value)}
                >
                  <option value="">Select…</option>
                  {sectionOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => set("pinned", e.target.checked)}
              />
              Pin to top
            </label>
          </div>

          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="inline-btn" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
