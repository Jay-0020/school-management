import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useBranding } from "../context/BrandingContext";
import type { StaffAttendanceMe, StaffAttendanceRow } from "../lib/types";

/** Great-circle distance in metres (haversine) — client-side gate; the server
 *  re-validates on check-in. */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Staff self check-in card — only lets you check in when inside the geofence. */
export function StaffCheckInCard() {
  const { settings } = useBranding();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["staff-att-me"],
    queryFn: async () => (await api.get<StaffAttendanceMe>("/staff-attendance/me")).data,
  });

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);

  const hasGeofence = settings?.latitude != null && settings?.longitude != null;
  const radius = settings?.geofenceRadius ?? 150;

  function locate() {
    if (!navigator.geolocation) {
      setGeoErr("Location isn't available on this device.");
      setLocating(false);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoErr(null);
        setLocating(false);
      },
      () => {
        setGeoErr("Allow location access to check in.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (hasGeofence) locate();
    else setLocating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGeofence]);

  const dist =
    pos && hasGeofence ? distanceMeters(pos.lat, pos.lng, settings!.latitude!, settings!.longitude!) : null;
  const inside = dist != null && dist <= radius;

  const checkin = useMutation({
    mutationFn: () => api.post("/staff-attendance/checkin", { latitude: pos!.lat, longitude: pos!.lng }),
    onSuccess: () => {
      setApiErr(null);
      qc.invalidateQueries({ queryKey: ["staff-att-me"] });
    },
    onError: (e) =>
      setApiErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Check-in failed"),
  });

  return (
    <div className="widget">
      <p className="widget-title">My Attendance</p>
      <div className="checkin-card">
        <div>
          <div className="checkin-pct">{me?.percentage != null ? `${me.percentage}%` : "—"}</div>
          <div className="checkin-status">
            {me ? `${me.attended} / ${me.workingDays} working days` : "Loading…"}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {me?.checkedInToday ? (
          <span className="badge-ok">Checked in today ✓</span>
        ) : !hasGeofence ? (
          <span className="muted">Campus location isn't set yet.</span>
        ) : locating ? (
          <span className="muted">Finding your location…</span>
        ) : geoErr ? (
          <span className="checkin-status">
            {geoErr}{" "}
            <button className="link" onClick={locate}>Retry</button>
          </span>
        ) : inside ? (
          <button className="inline-btn" disabled={checkin.isPending} onClick={() => checkin.mutate()}>
            📍 On Campus — Check in
          </button>
        ) : (
          <span className="badge-warn">
            Not on campus ({Math.round(dist!)} m away){" "}
            <button className="link" onClick={locate}>Recheck</button>
          </span>
        )}
      </div>
      {apiErr && <p className="error">{apiErr}</p>}
    </div>
  );
}

/** Dean / Admin staff-attendance. `preview` = compact dashboard tile linking to
 *  the full page; otherwise the full list. */
export function StaffAttendanceOverview({ preview = false }: { preview?: boolean }) {
  const { data } = useQuery({
    queryKey: ["staff-att-all"],
    queryFn: async () =>
      (await api.get<{ workingDays: number; staff: StaffAttendanceRow[] }>("/staff-attendance")).data,
  });
  if (!data) return null;

  const presentToday = data.staff.filter((s) => s.present).length;
  const rows = preview ? data.staff.slice(0, 3) : data.staff;

  return (
    <div className={`widget${preview ? " preview-tile" : ""}`}>
      <p className="widget-title">Staff Attendance</p>
      {preview && (
        <p className="muted" style={{ margin: "-4px 0 10px" }}>
          {presentToday} of {data.staff.length} present today
        </p>
      )}
      {data.staff.length === 0 && <p className="muted">No staff with logins yet.</p>}
      <div className="mini-list">
        {rows.map((s) => (
          <div className="mini-row" key={s.employeeNo}>
            <span className="mini-title">
              {s.present ? "🟢 " : "⚪ "}
              {s.name} <span className="muted">· {s.staffType === "TEACHING" ? "Teaching" : "Non-teaching"}</span>
            </span>
            <span className="mini-date">{s.percentage != null ? `${s.percentage}%` : "—"}</span>
          </div>
        ))}
      </div>
      {preview ? (
        <div className="tile-foot">
          <Link to="/staff-attendance">View all staff →</Link>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 10 }}>Attendance % is over {data.workingDays} working days this session.</p>
      )}
    </div>
  );
}
