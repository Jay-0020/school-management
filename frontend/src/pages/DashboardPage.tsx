import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import type { Role } from "../lib/types";

// Module tiles available per role — Phase 1 stubs, wired up in later phases.
const MODULES: Record<string, { label: string; roles: Role[] }> = {
  students: { label: "Students", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"] },
  teachers: { label: "Teachers & Staff", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  attendance: { label: "Attendance", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  notes: { label: "Notes", roles: ["STUDENT", "TEACHER"] },
  schoolwork: { label: "Schoolwork", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"] },
  fees: { label: "Fees", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"] },
  payroll: { label: "Payroll", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  expenses: { label: "Expense Approvals", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"] },
  settings: { label: "School Settings", roles: ["SUPER_ADMIN", "ADMIN"] },
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const branding = useBranding();
  if (!user) return null;

  const tiles = Object.entries(MODULES).filter(([, m]) => m.roles.includes(user.role));

  return (
    <div className="app-shell">
      <header className="topbar">
        <strong>{branding?.shortName ?? branding?.name ?? "School Portal"}</strong>
        <span className="spacer" />
        <span className="muted">{user.email}</span>
        <span className="badge">{user.role}</span>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <main className="content">
        {user.mustChangePassword && (
          <div className="notice">
            You're using a temporary password — please change it from Settings.
          </div>
        )}

        <h2>Dashboard</h2>
        <div className="grid">
          {tiles.map(([key, m]) => (
            <div className="tile" key={key}>
              <h3>{m.label}</h3>
              <p className="muted">Coming soon</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
