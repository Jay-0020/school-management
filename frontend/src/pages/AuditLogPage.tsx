import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { SkeletonRows } from "../components/EmptyState";
import type { AuditLogEntry } from "../lib/types";

interface AuditPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export function AuditLogPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", search, page],
    queryFn: async () =>
      (await api.get<AuditPage>("/audit", { params: { q: search || undefined, page } })).data,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell title="Activity Log">
      <div className="page-head">
        <h2>Activity Log</h2>
        <form
          className="controls"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <input
            placeholder="Search action, user or detail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button className="inline-btn" type="submit">Search</button>
        </form>
      </div>
      <p className="muted">A read-only record of sensitive actions across the school.</p>

      {isLoading && <SkeletonRows />}
      {data && data.items.length === 0 && <p className="muted">No activity recorded.</p>}

      {data && data.items.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td>
                  {e.actorEmail ?? "—"}
                  {e.actorRole ? <span className="muted"> · {e.actorRole}</span> : null}
                </td>
                <td><code>{e.action}</code></td>
                <td>{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && totalPages > 1 && (
        <div className="controls" style={{ marginTop: 12 }}>
          <button className="inline-btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span className="muted">Page {data.page} of {totalPages}</span>
          <button
            className="inline-btn ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </AppShell>
  );
}
