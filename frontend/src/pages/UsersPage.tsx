import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { toast } from "../lib/toast";
import type { ManagedUser, Role, Student, Teacher } from "../lib/types";

const ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "SUPER_ADMIN"];

function linkedLabel(u: ManagedUser): string {
  if (u.teacher) return `${u.teacher.firstName} ${u.teacher.lastName} (${u.teacher.employeeNo})`;
  if (u.student) return `${u.student.firstName} ${u.student.lastName} (${u.student.admissionNo})`;
  return "—";
}

export function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<{ items: ManagedUser[] }>("/users")).data.items,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const toggleActive = useMutation({
    mutationFn: (u: ManagedUser) => api.patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: invalidate,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("User deleted");
    },
  });

  const resetPw = useMutation({
    mutationFn: (vars: { id: string; newPassword: string }) =>
      api.post(`/users/${vars.id}/reset-password`, { newPassword: vars.newPassword }),
  });

  const [quotaUser, setQuotaUser] = useState<ManagedUser | null>(null);

  function handleReset(u: ManagedUser) {
    const pw = window.prompt(`New temporary password for ${u.email} (min 8 chars):`);
    if (!pw) return;
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    resetPw.mutate(
      { id: u.id, newPassword: pw },
      {
        onSuccess: () =>
          toast.success("Password reset — they'll change it on next login"),
      }
    );
  }

  return (
    <AppShell title="Users">
        <div className="page-head">
          <h2>Users {data ? <span className="muted">({data.length})</span> : null}</h2>
          <div className="controls">
            <button className="inline-btn" onClick={() => setCreating(true)}>
              + Add user
            </button>
          </div>
        </div>

        {isLoading && <p className="muted">Loading…</p>}

        {data && data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Linked to</th>
                <th>Leave/yr</th>
                <th>Last login</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.email}
                    {u.id === me?.id && <span className="muted"> (you)</span>}
                  </td>
                  <td>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td>{linkedLabel(u)}</td>
                  <td title="Casual / Sick">
                    {u.casualQuota}/{u.sickQuota}
                  </td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <span className={`status status-${u.isActive ? "active" : "inactive"}`}>
                      {u.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="link" onClick={() => handleReset(u)}>
                        Reset pw
                      </button>
                      <button className="link" onClick={() => setQuotaUser(u)}>
                        Quota
                      </button>
                      {u.id !== me?.id && (
                        <>
                          <button className="link" onClick={() => toggleActive.mutate(u)}>
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="link danger"
                            onClick={() => {
                              if (confirm(`Delete ${u.email}?`)) del.mutate(u.id);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {creating && <UserModal onClose={() => setCreating(false)} />}
      {quotaUser && <QuotaModal user={quotaUser} onClose={() => setQuotaUser(null)} />}
    </AppShell>
  );
}

// ── Leave quota modal ─────────────────────────────────────────────────────
function QuotaModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [casual, setCasual] = useState(String(user.casualQuota));
  const [sick, setSick] = useState(String(user.sickQuota));

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/users/${user.id}`, {
        casualQuota: Number(casual),
        sickQuota: Number(sick),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Leave quota updated");
      onClose();
    },
    onError: () => toast.error("Could not update quota"),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Leave quota</h3>
        <p className="muted hint">{user.email} — annual days per category</p>
        <div className="form-grid">
          <label>
            Casual
            <input type="number" value={casual} onChange={(e) => setCasual(e.target.value)} />
          </label>
          <label>
            Sick
            <input type="number" value={sick} onChange={(e) => setSick(e.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button className="inline-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="inline-btn" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add user modal ──────────────────────────────────────────────────────────
function UserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("TEACHER");
  const [linkId, setLinkId] = useState("");

  // Unlinked teachers/students for the link picker.
  const { data: teachers } = useQuery({
    queryKey: ["teachers", "all"],
    queryFn: async () =>
      (await api.get<{ items: (Teacher & { userId: string | null })[] }>("/teachers", {
        params: { pageSize: 100 },
      })).data.items,
    enabled: role === "TEACHER",
  });
  const { data: students } = useQuery({
    queryKey: ["students", "all"],
    queryFn: async () =>
      (await api.get<{ items: (Student & { userId: string | null })[] }>("/students", {
        params: { pageSize: 100 },
      })).data.items,
    enabled: role === "STUDENT" || role === "PARENT",
  });

  const teacherOpts = useMemo(
    () => (teachers ?? []).filter((t) => !t.userId),
    [teachers]
  );
  // For a student login: only unlinked students. For a parent: any student (the child).
  const studentOpts = useMemo(
    () => (role === "PARENT" ? (students ?? []) : (students ?? []).filter((s) => !s.userId)),
    [students, role]
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { email, password, role };
      if (role === "TEACHER" && linkId) payload.teacherId = linkId;
      if (role === "STUDENT" && linkId) payload.studentId = linkId;
      if (role === "PARENT" && linkId) payload.childId = linkId;
      return api.post("/users", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not create user";
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
        <h3>Add user</h3>
        <form onSubmit={handleSubmit}>
          <label className="stack-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="stack-label">
            Temporary password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 characters"
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Role
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  setLinkId("");
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            {role === "TEACHER" && (
              <label>
                Link to teacher
                <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                  <option value="">Unlinked</option>
                  {teacherOpts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.employeeNo})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {role === "STUDENT" && (
              <label>
                Link to student
                <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                  <option value="">Unlinked</option>
                  {studentOpts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {role === "PARENT" && (
              <label>
                Child (student)
                <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                  <option value="">Not linked</option>
                  {studentOpts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <p className="muted hint">
            The user signs in with this email + temporary password and is asked to change it.
          </p>

          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            <button type="button" className="inline-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="inline-btn" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
