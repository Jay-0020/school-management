import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import type {
  ClassWithSections,
  EnrollmentStatus,
  Paginated,
  Student,
} from "../lib/types";

const PAGE_SIZE = 25;
const STATUSES: EnrollmentStatus[] = ["ACTIVE", "INACTIVE", "ALUMNI", "TRANSFERRED"];

interface SectionOption {
  id: string;
  label: string; // "Grade 5 · A"
}

export function StudentsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [page, setPage] = useState(1);
  const [sectionId, setSectionId] = useState<string>("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);

  // Section options for filter + form, flattened from classes.
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
  });
  const sectionOptions: SectionOption[] = useMemo(
    () =>
      (classes ?? []).flatMap((c) =>
        c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` }))
      ),
    [classes]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["students", page, sectionId],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
      if (sectionId) params.sectionId = sectionId;
      return (await api.get<Paginated<Student>>("/students", { params })).data;
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="app-shell">
      <PageHeader title="Students" />
      <main className="content">
        <div className="page-head">
          <h2>Students {data ? <span className="muted">({data.total})</span> : null}</h2>
          <div className="controls">
            <select
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All sections</option>
              {sectionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {canEdit && (
              <button className="inline-btn" onClick={() => setCreating(true)}>
                + Add student
              </button>
            )}
          </div>
        </div>

        {isLoading && <p className="muted">Loading…</p>}

        {data && data.items.length === 0 && (
          <div className="panel">
            <p className="muted">No students found.</p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Adm. No</th>
                <th>Name</th>
                <th>Class · Section</th>
                <th>Guardian</th>
                <th>Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td>{s.admissionNo}</td>
                  <td>
                    {s.firstName} {s.lastName}
                  </td>
                  <td>
                    {s.section ? `${s.section.class.name} · ${s.section.name}` : "—"}
                  </td>
                  <td>{s.guardianName ?? "—"}</td>
                  <td>
                    <span className={`status status-${s.status.toLowerCase()}`}>
                      {s.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <button className="link" onClick={() => setEditing(s)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && totalPages > 1 && (
          <div className="pager">
            <button
              className="inline-btn ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="muted">
              Page {page} of {totalPages}
            </span>
            <button
              className="inline-btn ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {(creating || editing) && (
        <StudentModal
          student={editing}
          sectionOptions={sectionOptions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ── Add / edit modal ────────────────────────────────────────────────────────
type FormState = {
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  sectionId: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  status: EnrollmentStatus;
};

function StudentModal({
  student,
  sectionOptions,
  onClose,
}: {
  student: Student | null;
  sectionOptions: SectionOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!student;
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    admissionNo: student?.admissionNo ?? "",
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    gender: student?.gender ?? "",
    sectionId: student?.sectionId ?? "",
    guardianName: student?.guardianName ?? "",
    guardianPhone: student?.guardianPhone ?? "",
    address: student?.address ?? "",
    status: student?.status ?? "ACTIVE",
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        sectionId: form.sectionId || null,
        gender: form.gender || null,
        guardianName: form.guardianName || null,
        guardianPhone: form.guardianPhone || null,
        address: form.address || null,
      };
      if (isEdit) {
        // admissionNo isn't editable
        const { admissionNo: _drop, ...rest } = payload;
        void _drop;
        return api.patch(`/students/${student!.id}`, rest);
      }
      return api.post("/students", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not save student";
      setError(message);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Edit student" : "Add student"}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Admission no.
            <input
              value={form.admissionNo}
              onChange={(e) => set("admissionNo", e.target.value)}
              disabled={isEdit}
              required
            />
          </label>
          <label>
            Section
            <select value={form.sectionId} onChange={(e) => set("sectionId", e.target.value)}>
              <option value="">Unassigned</option>
              {sectionOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            First name
            <input
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              required
            />
          </label>
          <label>
            Last name
            <input
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              required
            />
          </label>
          <label>
            Gender
            <input value={form.gender} onChange={(e) => set("gender", e.target.value)} />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as EnrollmentStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Guardian name
            <input
              value={form.guardianName}
              onChange={(e) => set("guardianName", e.target.value)}
            />
          </label>
          <label>
            Guardian phone
            <input
              value={form.guardianPhone}
              onChange={(e) => set("guardianPhone", e.target.value)}
            />
          </label>
          <label className="full-width">
            Address
            <input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </label>

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
