import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import type { Role } from "../lib/types";

// Module tiles available per role. `path` is set once a module is built;
// the rest are Phase-1 stubs wired up in later phases.
const MODULES: Record<string, { label: string; roles: Role[]; path?: string }> = {
  students: { label: "Students", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"], path: "/students" },
  teachers: { label: "Teachers & Staff", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"], path: "/teachers" },
  attendance: { label: "Attendance", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], path: "/attendance" },
  notices: { label: "Notices", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"], path: "/notices" },
  notes: { label: "Notes", roles: ["STUDENT", "TEACHER"] },
  schoolwork: { label: "Schoolwork", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"], path: "/schoolwork" },
  fees: { label: "Fees", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"], path: "/fees" },
  payroll: { label: "Payroll", roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  expenses: { label: "Expense Approvals", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"] },
  users: { label: "User Management", roles: ["SUPER_ADMIN", "ADMIN"], path: "/users" },
  settings: { label: "School Setup", roles: ["SUPER_ADMIN", "ADMIN"], path: "/setup" },
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { settings: branding } = useBranding();
  if (!user) return null;

  const tiles = Object.entries(MODULES).filter(([, m]) => m.roles.includes(user.role));

  return (
    <div className="app-shell">
      <header className="topbar">
        <strong>{branding?.shortName ?? branding?.name ?? "School Portal"}</strong>
        <span className="spacer" />
        <span className="muted">{user.email}</span>
        <span className="badge">{user.role}</span>
        <Link className="link" to="/change-password">
          Change password
        </Link>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <main className="content">
        {user.mustChangePassword && (
          <div className="notice">
            You're using a temporary password —{" "}
            <Link to="/change-password">change it now</Link>.
          </div>
        )}

        <h2>Dashboard</h2>
        <div className="grid">
          {tiles.map(([key, m]) =>
            m.path ? (
              <Link className="tile tile-link" to={m.path} key={key}>
                <h3>{m.label}</h3>
                <p className="muted">Open →</p>
              </Link>
            ) : (
              <div className="tile" key={key}>
                <h3>{m.label}</h3>
                <p className="muted">Coming soon</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
