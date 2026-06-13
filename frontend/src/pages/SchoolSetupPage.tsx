import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import type { ClassWithSections, SchoolSettings } from "../lib/types";

export function SchoolSetupPage() {
  const { user, logout } = useAuth();
  const { settings, refresh } = useBranding();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="link" to="/">
          ← Dashboard
        </Link>
        <strong>School Setup</strong>
        <span className="spacer" />
        <span className="muted">{user?.email}</span>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <main className="content">
        <h2>School Setup</h2>
        <BrandingPanel settings={settings} onSaved={refresh} />
        <ClassesPanel />
      </main>
    </div>
  );
}

// ── Branding / white-label settings ────────────────────────────────────────
function BrandingPanel({
  settings,
  onSaved,
}: {
  settings: SchoolSettings | null;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<SchoolSettings | null>(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setForm(settings), [settings]);

  const mutation = useMutation({
    mutationFn: (data: SchoolSettings) => api.put("/school/settings", data),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await onSaved();
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setError("Could not save settings"),
  });

  if (!form) return <section className="panel">Loading settings…</section>;

  function update<K extends keyof SchoolSettings>(key: K, value: SchoolSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form) mutation.mutate(form);
  }

  return (
    <section className="panel">
      <h3>Branding & details</h3>
      <p className="muted">These theme the portal for this school.</p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          School name
          <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </label>
        <label>
          Short name
          <input
            value={form.shortName ?? ""}
            onChange={(e) => update("shortName", e.target.value)}
          />
        </label>
        <label>
          Primary colour
          <span className="color-row">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
            />
            <input
              value={form.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
            />
          </span>
        </label>
        <label>
          Logo URL
          <input
            value={form.logoUrl ?? ""}
            onChange={(e) => update("logoUrl", e.target.value)}
          />
        </label>
        <label>
          Contact email
          <input
            type="email"
            value={form.contactEmail ?? ""}
            onChange={(e) => update("contactEmail", e.target.value)}
          />
        </label>
        <label>
          Contact phone
          <input
            value={form.contactPhone ?? ""}
            onChange={(e) => update("contactPhone", e.target.value)}
          />
        </label>
        <label>
          Currency
          <input value={form.currency} onChange={(e) => update("currency", e.target.value)} />
        </label>
        <label>
          Academic year
          <input
            placeholder="2026-2027"
            value={form.academicYear ?? ""}
            onChange={(e) => update("academicYear", e.target.value)}
          />
        </label>

        <div className="form-actions">
          {error && <span className="error inline">{error}</span>}
          {saved && <span className="ok inline">Saved ✓</span>}
          <button className="inline-btn" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Classes & sections ──────────────────────────────────────────────────────
function ClassesPanel() {
  const qc = useQueryClient();
  const [className, setClassName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["classes"] });

  const addClass = useMutation({
    mutationFn: (name: string) => api.post("/classes", { name }),
    onSuccess: () => {
      setClassName("");
      invalidate();
    },
  });

  const deleteClass = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/${id}`),
    onSuccess: invalidate,
  });

  return (
    <section className="panel">
      <h3>Classes & sections</h3>
      <p className="muted">Define the academic structure students are enrolled into.</p>

      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (className.trim()) addClass.mutate(className.trim());
        }}
      >
        <input
          placeholder="New class (e.g. Grade 5)"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
        />
        <button className="inline-btn" type="submit" disabled={addClass.isPending}>
          Add class
        </button>
      </form>

      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && <p className="muted">No classes yet.</p>}

      <div className="class-list">
        {data?.map((cls) => (
          <ClassRow
            key={cls.id}
            cls={cls}
            onChanged={invalidate}
            onDelete={() => deleteClass.mutate(cls.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ClassRow({
  cls,
  onChanged,
  onDelete,
}: {
  cls: ClassWithSections;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [sectionName, setSectionName] = useState("");

  const addSection = useMutation({
    mutationFn: (name: string) => api.post(`/classes/${cls.id}/sections`, { name }),
    onSuccess: () => {
      setSectionName("");
      onChanged();
    },
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/sections/${id}`),
    onSuccess: onChanged,
  });

  return (
    <div className="class-card">
      <div className="class-head">
        <strong>{cls.name}</strong>
        <button className="link danger" onClick={onDelete} title="Delete class">
          Delete
        </button>
      </div>

      <div className="section-chips">
        {cls.sections.length === 0 && <span className="muted">No sections</span>}
        {cls.sections.map((s) => (
          <span className="chip" key={s.id}>
            {s.name} · {s._count.students}
            <button
              className="chip-x"
              onClick={() => deleteSection.mutate(s.id)}
              title="Delete section"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <form
        className="add-row small"
        onSubmit={(e) => {
          e.preventDefault();
          if (sectionName.trim()) addSection.mutate(sectionName.trim());
        }}
      >
        <input
          placeholder="Section (e.g. A)"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
        />
        <button className="inline-btn ghost" type="submit" disabled={addSection.isPending}>
          Add section
        </button>
      </form>
    </div>
  );
}
