import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconStudents } from "../components/icons";
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | EnrollmentStatus>("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasFilters = !!(sectionId || search || status);

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
    queryKey: ["students", page, sectionId, search, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
      if (sectionId) params.sectionId = sectionId;
      if (search) params.search = search;
      if (status) params.status = status;
      return (await api.get<Paginated<Student>>("/students", { params })).data;
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell title="Students">
        <div className="page-head">
          <h2>Students {data ? <span className="muted">({data.total})</span> : null}</h2>
          <div className="controls">
            <input
              type="search"
              placeholder="Search name or admission no…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | EnrollmentStatus);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
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

        {isLoading && <SkeletonRows />}

        {data && data.items.length === 0 && (
          <EmptyState
            icon={IconStudents}
            title={hasFilters ? "No matching students" : "No students yet"}
            hint={
              hasFilters
                ? "Try a different search or clear the filters."
                : "Add your first student to get started."
            }
          />
        )}

        {data && data.items.length > 0 && (
          <table className="data-table cards">
            <thead>
              <tr>
                <th>Adm. No</th>
                <th>Name</th>
                <th>Class · Section</th>
                <th>Guardian</th>
                <th>Parent account</th>
                <th>Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td data-label="Adm. No">{s.admissionNo}</td>
                  <td data-label="Name">
                    {s.firstName} {s.lastName}
                  </td>
                  <td data-label="Class · Section">
                    {s.section ? `${s.section.class.name} · ${s.section.name}` : "—"}
                  </td>
                  <td data-label="Guardian">{s.guardianName ?? "—"}</td>
                  <td data-label="Parent">{s.parent?.email ?? <span className="muted">—</span>}</td>
                  <td data-label="Status">
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
    </AppShell>
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
  admissionDate: string;
  parentId: string;
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
    admissionDate: student?.admissionDate ? student.admissionDate.slice(0, 10) : "",
    parentId: student?.parentId ?? "",
  });

  const { data: parents } = useQuery({
    queryKey: ["parent-accounts"],
    queryFn: async () =>
      (await api.get<{ items: { id: string; email: string; children: string[] }[] }>(
        "/students/parents"
      )).data.items,
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
        admissionDate: form.admissionDate || null,
        parentId: form.parentId || null,
      };
      if (isEdit) {
        // admissionNo isn't editable; status changes drive retention (leftAt)
        // via the dedicated leave/reactivate endpoints.
        const { admissionNo: _drop, status, ...rest } = payload;
        void _drop;
        await api.patch(`/students/${student!.id}`, rest);
        if (status !== student!.status) {
          if (status === "ACTIVE") await api.post(`/students/${student!.id}/reactivate`);
          else await api.post(`/students/${student!.id}/leave`, { status });
        }
        return;
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
            Admission date
            <input
              type="date"
              value={form.admissionDate}
              onChange={(e) => set("admissionDate", e.target.value)}
            />
          </label>
          <label>
            Parent account
            <select value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
              <option value="">No parent linked</option>
              {parents?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.email}
                  {p.children.length ? ` — ${p.children.join(", ")}` : ""}
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
