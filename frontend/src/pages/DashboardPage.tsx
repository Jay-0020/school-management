import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { SkeletonStats } from "../components/EmptyState";
import { IconBell } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import { navForRole } from "../lib/nav";

interface Stat {
  key: string;
  label: string;
  value: string;
  hint?: string;
}
interface NoticeBrief {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useBranding();

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () =>
      (await api.get<{ stats: Stat[]; notices: NoticeBrief[] }>("/dashboard")).data,
  });

  if (!user) return null;

  // Quick actions = the user's nav items (minus Dashboard itself).
  const actions = navForRole(user.role)
    .flatMap((g) => g.items)
    .filter((i) => i.path !== "/")
    .slice(0, 8);

  const greeting = settings?.name ?? "your school";

  return (
    <AppShell title="Dashboard">
      <div className="dash-hero">
        <h2>Welcome back 👋</h2>
        <p className="muted">Here's what's happening at {greeting}.</p>
      </div>

      {!data ? (
        <SkeletonStats count={5} />
      ) : (
        <div className="stat-grid">
          {data.stats.map((s) => (
            <div className="stat-card" key={s.key}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              {s.hint && <div className="stat-hint">{s.hint}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="dash-cols">
        <div className="widget">
          <p className="widget-title">Quick actions</p>
          <div className="quick-actions">
            {actions.map((a) => (
              <Link className="quick-action" to={a.path} key={a.path}>
                <a.icon className="nav-icon" />
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="widget">
          <p className="widget-title">Recent notices</p>
          {data && data.notices.length === 0 && <p className="muted">No notices yet.</p>}
          <div className="mini-list">
            {data?.notices.map((n) => (
              <Link to="/notices" className="mini-row" key={n.id}>
                <IconBell className="nav-icon" />
                <span className="mini-title">
                  {n.pinned && "📌 "}
                  {n.title}
                </span>
                <span className="mini-date">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
