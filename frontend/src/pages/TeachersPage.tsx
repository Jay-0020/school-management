import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconTeacher } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import type { Paginated, StaffType, Teacher } from "../lib/types";

const PAGE_SIZE = 25;
const STAFF_TYPES: StaffType[] = ["TEACHING", "NON_TEACHING"];
const STAFF_LABEL: Record<StaffType, string> = {
  TEACHING: "Teaching",
  NON_TEACHING: "Non-teaching",
};

export function TeachersPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [creating, setCreating] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [staffType, setStaffType] = useState<"" | StaffType>("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasFilters = !!(search || staffType || status);

  const { data, isLoading } = useQuery({
    queryKey: ["teachers", page, search, staffType, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
      if (search) params.search = search;
      if (staffType) params.staffType = staffType;
      if (status) params.status = status;
      return (await api.get<Paginated<Teacher>>("/teachers", { params })).data;
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell title="Teachers & Staff">
        <div className="page-head">
          <h2>
            Teachers & Staff {data ? <span className="muted">({data.total})</span> : null}
          </h2>
          <div className="controls">
            <input
              type="search"
              placeholder="Search name, employee no., or contact…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <select
              value={staffType}
              onChange={(e) => {
                setStaffType(e.target.value as "" | StaffType);
                setPage(1);
              }}
            >
              <option value="">All types</option>
              {STAFF_TYPES.map((s) => (
                <option key={s} value={s}>
                  {STAFF_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | "active" | "inactive");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {canEdit && (
              <button className="inline-btn" onClick={() => setCreating(true)}>
                + Add staff
              </button>
            )}
          </div>
        </div>

        {isLoading && <SkeletonRows />}

        {data && data.items.length === 0 && (
          <EmptyState
            icon={IconTeacher}
            title={hasFilters ? "No matching staff" : "No staff yet"}
            hint={
              hasFilters
                ? "Try a different search or clear the filters."
                : "Add teaching and non-teaching staff to manage their records and payroll."
            }
          />
        )}

        {data && data.items.length > 0 && (
          <table className="data-table cards">
            <thead>
              <tr>
                <th>Employee no.</th>
                <th>Name</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <td data-label="Employee no.">{t.employeeNo}</td>
                  <td data-label="Name">
                    {t.firstName} {t.lastName}
                  </td>
                  <td data-label="Type">{STAFF_LABEL[t.staffType]}</td>
                  <td data-label="Contact">{t.phone ?? t.email ?? "—"}</td>
                  <td data-label="Status">
                    <span className={`status status-${t.isActive ? "active" : "inactive"}`}>
                      {t.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <button className="link" onClick={() => setEditing(t)}>
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
        <TeacherModal
          teacher={editing}
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
  employeeNo: string;
  firstName: string;
  lastName: string;
  staffType: StaffType;
  qualifications: string;
  joiningDate: string;
  phone: string;
  email: string;
  isActive: boolean;
};

function TeacherModal({
  teacher,
  onClose,
}: {
  teacher: Teacher | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!teacher;
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    employeeNo: teacher?.employeeNo ?? "",
    firstName: teacher?.firstName ?? "",
    lastName: teacher?.lastName ?? "",
    staffType: teacher?.staffType ?? "TEACHING",
    qualifications: teacher?.qualifications ?? "",
    joiningDate: teacher?.joiningDate ? teacher.joiningDate.slice(0, 10) : "",
    phone: teacher?.phone ?? "",
    email: teacher?.email ?? "",
    isActive: teacher?.isActive ?? true,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const base = {
        firstName: form.firstName,
        lastName: form.lastName,
        staffType: form.staffType,
        qualifications: form.qualifications || null,
        joiningDate: form.joiningDate || null,
        phone: form.phone || null,
        email: form.email || null,
      };
      if (isEdit) {
        return api.patch(`/teachers/${teacher!.id}`, { ...base, isActive: form.isActive });
      }
      return api.post("/teachers", { ...base, employeeNo: form.employeeNo });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not save staff member";
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
        <h3>{isEdit ? "Edit staff member" : "Add staff member"}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Employee no.
            <input
              value={form.employeeNo}
              onChange={(e) => set("employeeNo", e.target.value)}
              disabled={isEdit}
              required
            />
          </label>
          <label>
            Staff type
            <select
              value={form.staffType}
              onChange={(e) => set("staffType", e.target.value as StaffType)}
            >
              {STAFF_TYPES.map((s) => (
                <option key={s} value={s}>
                  {STAFF_LABEL[s]}
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
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label>
            Joining date
            <input
              type="date"
              value={form.joiningDate}
              onChange={(e) => set("joiningDate", e.target.value)}
            />
          </label>
          <label>
            Qualifications
            <input
              value={form.qualifications}
              onChange={(e) => set("qualifications", e.target.value)}
            />
          </label>
          {isEdit && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
              />
              Active
            </label>
          )}

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
