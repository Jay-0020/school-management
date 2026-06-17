import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { RoleHome } from "../components/RoleHome";
import { SkeletonStats } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import { navForRole } from "../lib/nav";
import type { SchoolCalendar as Cal } from "../lib/types";

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

  const { data: cal } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => (await api.get<Cal>("/school/calendar")).data,
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

      <div className="dash-stack">
        {!data ? (
          <SkeletonStats count={5} />
        ) : (
          <RoleHome
            role={user.role}
            stats={data.stats}
            notices={data.notices}
            actions={actions}
            cal={cal}
          />
        )}
      </div>
    </AppShell>
  );
}
