import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import type { ClassWithSections, Homework, Subject } from "../lib/types";

function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}

interface SectionOption {
  id: string;
  label: string;
}

export function SchoolworkPage() {
  const { user } = useAuth();
  const isStaff =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.role === "TEACHER";
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [tab, setTab] = useState<"homework" | "subjects">("homework");

  return (
    <AppShell title="Schoolwork">
        <h2>Schoolwork</h2>

        {isAdmin && (
          <div className="tabs">
            <button
              className={`tab ${tab === "homework" ? "active" : ""}`}
              onClick={() => setTab("homework")}
            >
              Homework
            </button>
            <button
              className={`tab ${tab === "subjects" ? "active" : ""}`}
              onClick={() => setTab("subjects")}
            >
              Subjects
            </button>
          </div>
        )}

        {tab === "homework" ? <HomeworkTab isStaff={isStaff} /> : <SubjectsTab />}
    </AppShell>
  );
}

// ── Homework ────────────────────────────────────────────────────────────────
function HomeworkTab({ isStaff }: { isStaff: boolean }) {
  const { user } = useAuth();
  const [sectionId, setSectionId] = useState("");
  const [editing, setEditing] = useState<Homework | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
    enabled: isStaff,
  });
  const sectionOptions: SectionOption[] = useMemo(
    () =>
      (classes ?? []).flatMap((c) =>
        c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))
      ),
    [classes]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["homework", sectionId],
    queryFn: async () => {
      const params = sectionId ? { sectionId } : {};
      return (await api.get<{ items: Homework[] }>("/schoolwork/homework", { params })).data
        .items;
    },
  });

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/schoolwork/homework/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["homework"] }),
  });

  function canManage(h: Homework) {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    return h.assignedBy?.id === user.id;
  }

  return (
    <section className="panel">
      <div className="page-head">
        {isStaff ? (
          <div className="controls">
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All sections</option>
              {sectionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span />
        )}
        {isStaff && (
          <button className="inline-btn" onClick={() => setCreating(true)}>
            + Assign homework
          </button>
        )}
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && <p className="muted">No homework.</p>}

      <div className="notice-list">
        {data?.map((h) => (
          <article className="notice-card" key={h.id}>
            <div className="notice-top">
              <h3>{h.title}</h3>
              {h.subject && <span className="audience-badge">{h.subject.name}</span>}
            </div>
            <p className="notice-body">{h.description}</p>
            <div className="notice-foot">
              <span className="muted">
                {h.section ? `${h.section.class.name} · ${h.section.name}` : ""}
                {h.dueDate ? ` · due ${new Date(h.dueDate).toLocaleDateString()}` : ""}
              </span>
              {canManage(h) && (
                <span className="notice-actions">
                  <button className="link" onClick={() => setEditing(h)}>
                    Edit
                  </button>
                  <button
                    className="link danger"
                    onClick={() => {
                      if (confirm("Delete this homework?")) del.mutate(h.id);
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
        <HomeworkModal
          homework={editing}
          sectionOptions={sectionOptions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

type FormState = {
  title: string;
  description: string;
  sectionId: string;
  subjectId: string;
  dueDate: string;
};

function HomeworkModal({
  homework,
  sectionOptions,
  onClose,
}: {
  homework: Homework | null;
  sectionOptions: SectionOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!homework;
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    title: homework?.title ?? "",
    description: homework?.description ?? "",
    sectionId: homework?.sectionId ?? "",
    subjectId: homework?.subjectId ?? "",
    dueDate: homework?.dueDate ? homework.dueDate.slice(0, 10) : "",
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () =>
      (await api.get<{ items: Subject[] }>("/schoolwork/subjects")).data.items,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description,
        sectionId: form.sectionId,
        subjectId: form.subjectId || null,
        dueDate: form.dueDate || null,
      };
      return isEdit
        ? api.patch(`/schoolwork/homework/${homework!.id}`, payload)
        : api.post("/schoolwork/homework", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homework"] });
      onClose();
    },
    onError: (err) => setError(errMsg(err, "Could not save homework")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.sectionId) {
      setError("Pick a section");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Edit homework" : "Assign homework"}</h3>
        <form onSubmit={handleSubmit}>
          <label className="stack-label">
            Title
            <input value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </label>
          <label className="stack-label">
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Section
              <select value={form.sectionId} onChange={(e) => set("sectionId", e.target.value)}>
                <option value="">Select…</option>
                {sectionOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <select value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
                <option value="">None</option>
                {(subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
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

// ── Subjects ────────────────────────────────────────────────────────────────
function SubjectsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () =>
      (await api.get<{ items: Subject[] }>("/schoolwork/subjects")).data.items,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["subjects"] });

  const add = useMutation({
    mutationFn: () => api.post("/schoolwork/subjects", { name, code: code || null }),
    onSuccess: () => {
      setName("");
      setCode("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errMsg(err, "Could not add subject")),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/schoolwork/subjects/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(errMsg(err, "Could not delete subject")),
  });

  return (
    <section className="panel">
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <input
          placeholder="Subject name (e.g. Mathematics)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Code (optional)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ maxWidth: 140 }}
        />
        <button className="inline-btn" type="submit" disabled={add.isPending}>
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {data && data.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Code</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.code ?? "—"}</td>
                <td>
                  <button className="link danger" onClick={() => del.mutate(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No subjects yet.</p>
      )}
    </section>
  );
}
