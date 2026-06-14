import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { AppNotification } from "../lib/types";
import { IconBell } from "./icons";

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get<{ items: AppNotification[]; unread: number }>("/notifications")).data,
    refetchInterval: 30000,
  });

  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = data?.unread ?? 0;

  function openItem(n: AppNotification) {
    if (!n.read) readOne.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} title="Notifications">
        <IconBell />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="menu-pop notif-pop">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link" onClick={() => readAll.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          {(!data || data.items.length === 0) && (
            <p className="muted notif-empty">You're all caught up.</p>
          )}
          {data?.items.map((n) => (
            <button
              key={n.id}
              className={`notif-row ${n.read ? "" : "unread"}`}
              onClick={() => openItem(n)}
            >
              <span className="notif-msg">{n.message}</span>
              <span className="notif-time">{new Date(n.createdAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
