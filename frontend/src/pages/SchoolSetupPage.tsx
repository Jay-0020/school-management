import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { LocationPicker } from "../components/LocationPicker";
import { SchoolCalendar } from "../components/SchoolCalendar";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";
import type {
  ClassWithSections,
  SaturdayRule,
  SchoolCalendar as Cal,
  SchoolSettings,
} from "../lib/types";

/** Pull a human-readable message out of an axios error. */
function errMsg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}

export function SchoolSetupPage() {
  const { settings, refresh } = useBranding();
  const { user } = useAuth();
  const canAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <AppShell title="School Setup">
      <BrandingPanel settings={settings} onSaved={refresh} canAdmin={canAdmin} />
      <LocationPanel settings={settings} onSaved={refresh} canAdmin={canAdmin} />
      <CalendarPanel />
      <ClassesPanel canAdmin={canAdmin} />
    </AppShell>
  );
}

// ── Branding / white-label settings ────────────────────────────────────────
function BrandingPanel({
  settings,
  onSaved,
  canAdmin,
}: {
  settings: SchoolSettings | null;
  onSaved: () => Promise<void>;
  canAdmin: boolean;
}) {
  const [form, setForm] = useState<SchoolSettings | null>(settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setForm(settings), [settings]);

  const mutation = useMutation({
    mutationFn: (data: SchoolSettings) => api.put("/school/settings", data),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await onSaved();
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(errMsg(err, "Could not save settings")),
  });

  if (!form) return <section className="panel">Loading settings…</section>;

  function update<K extends keyof SchoolSettings>(key: K, value: SchoolSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form) mutation.mutate(form);
  }

  return (
    <section className="panel">
      <h3>Branding & details</h3>
      <p className="muted">These theme the portal for this school.</p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <fieldset disabled={!canAdmin} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
          <label>
            School name
            <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </label>
          <label>
            Short name
            <input value={form.shortName ?? ""} onChange={(e) => update("shortName", e.target.value)} />
          </label>
          <label>
            Primary colour
            <span className="color-row">
              <input type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
              <input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
            </span>
          </label>
          <label>
            Logo URL
            <input value={form.logoUrl ?? ""} onChange={(e) => update("logoUrl", e.target.value)} />
          </label>
          <label>
            Contact email
            <input type="email" value={form.contactEmail ?? ""} onChange={(e) => update("contactEmail", e.target.value)} />
          </label>
          <label>
            Contact phone
            <input value={form.contactPhone ?? ""} onChange={(e) => update("contactPhone", e.target.value)} />
          </label>
          <label>
            Currency
            <input value={form.currency} onChange={(e) => update("currency", e.target.value)} />
          </label>
          <label>
            Academic year
            <input placeholder="2026-2027" value={form.academicYear ?? ""} onChange={(e) => update("academicYear", e.target.value)} />
          </label>
        </fieldset>

        {canAdmin ? (
          <div className="form-actions">
            {error && <span className="error inline">{error}</span>}
            {saved && <span className="ok inline">Saved ✓</span>}
            <button className="inline-btn" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        ) : (
          <p className="muted">View only — an admin manages branding.</p>
        )}
      </form>
    </section>
  );
}

// ── Campus location & geofence ──────────────────────────────────────────────
function LocationPanel({
  settings,
  onSaved,
  canAdmin,
}: {
  settings: SchoolSettings | null;
  onSaved: () => Promise<void>;
  canAdmin: boolean;
}) {
  const [lat, setLat] = useState<number | null>(settings?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(settings?.longitude ?? null);
  const [radius, setRadius] = useState<number>(settings?.geofenceRadius ?? 150);
  const [saved, setSaved] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setLat(settings.latitude ?? null);
      setLng(settings.longitude ?? null);
      setRadius(settings.geofenceRadius ?? 150);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () =>
      api.put("/school/settings", { latitude: lat, longitude: lng, geofenceRadius: radius }),
    onSuccess: async () => {
      setSaved(true);
      await onSaved();
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function useMyLocation() {
    if (!navigator.geolocation) return setGeoErr("Geolocation is not supported here.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoErr(null);
      },
      () => setGeoErr("Could not get your location — allow location access."),
      { enableHighAccuracy: true }
    );
  }

  return (
    <section className="panel">
      <h3>Campus location & geofence</h3>
      <p className="muted">
        Staff can only check in <strong>“On Campus”</strong> when they're within this radius of the
        school. Click the map to set the location.
      </p>

      <LocationPicker
        latitude={lat}
        longitude={lng}
        radius={radius}
        onChange={(la, ln) => {
          if (canAdmin) {
            setLat(la);
            setLng(ln);
          }
        }}
      />

      <div className="form-grid" style={{ marginTop: 12 }}>
        <label>
          Latitude
          <input value={lat ?? ""} readOnly />
        </label>
        <label>
          Longitude
          <input value={lng ?? ""} readOnly />
        </label>
        <label>
          Radius (metres)
          <input
            type="number"
            min={20}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            disabled={!canAdmin}
          />
        </label>
      </div>

      {canAdmin ? (
        <div className="form-actions">
          {geoErr && <span className="error inline">{geoErr}</span>}
          {saved && <span className="ok inline">Saved ✓</span>}
          <button type="button" className="inline-btn ghost" onClick={useMyLocation}>
            📍 Use my current location
          </button>
          <button
            type="button"
            className="inline-btn"
            disabled={mutation.isPending || lat == null}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save location"}
          </button>
        </div>
      ) : (
        <p className="muted">View only — an admin sets the campus location.</p>
      )}
    </section>
  );
}

// ── Academic calendar ───────────────────────────────────────────────────────
function CalendarPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => (await api.get<Cal>("/school/calendar")).data,
  });

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rule, setRule] = useState<SaturdayRule>("NONE");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setStart(data.sessionStart ? data.sessionStart.slice(0, 10) : "");
      setEnd(data.sessionEnd ? data.sessionEnd.slice(0, 10) : "");
      setRule(data.saturdayRule);
    }
  }, [data]);

  const saveCfg = useMutation({
    mutationFn: () =>
      api.put("/school/calendar", { sessionStart: start || null, sessionEnd: end || null, saturdayRule: rule }),
    onSuccess: async () => {
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const toggle = useMutation({
    mutationFn: (v: { date: string; isHoliday: boolean; note: string | null }) =>
      api.post("/school/calendar/holiday", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });

  if (isLoading || !data) return <section className="panel">Loading calendar…</section>;

  const SAT_LABEL: Record<SaturdayRule, string> = {
    NONE: "All working",
    ALL: "All off",
    ALTERNATE: "2nd & 4th off",
  };

  return (
    <section className="panel">
      <h3>Academic calendar</h3>
      <p className="muted">
        Set the session dates and how Saturdays work. Sundays are always holidays. Working days this
        session: <strong>{data.workingDays}</strong>.
      </p>

      <div className="form-grid">
        <label>
          Session start
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Session end
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <div className="radio-row">
        <span className="muted">Saturdays:</span>
        {(["NONE", "ALL", "ALTERNATE"] as SaturdayRule[]).map((r) => (
          <label key={r} className="radio">
            <input type="radio" name="sat" checked={rule === r} onChange={() => setRule(r)} /> {SAT_LABEL[r]}
          </label>
        ))}
      </div>

      <div className="form-actions">
        {saved && <span className="ok inline">Saved ✓</span>}
        <button className="inline-btn" disabled={saveCfg.isPending} onClick={() => saveCfg.mutate()}>
          {saveCfg.isPending ? "Saving…" : "Save calendar"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <SchoolCalendar
          cal={data}
          onToggle={(date, isHoliday, note) => toggle.mutate({ date, isHoliday, note })}
          saving={toggle.isPending}
        />
      </div>
    </section>
  );
}

// ── Classes & sections ──────────────────────────────────────────────────────
function ClassesPanel({ canAdmin }: { canAdmin: boolean }) {
  const qc = useQueryClient();
  const [className, setClassName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await api.get<{ items: ClassWithSections[] }>("/classes")).data.items,
  });

  const [error, setError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["classes"] });

  const addClass = useMutation({
    mutationFn: (name: string) => api.post("/classes", { name }),
    onSuccess: () => {
      setClassName("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errMsg(err, "Could not add class")),
  });

  const deleteClass = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/${id}`),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errMsg(err, "Could not delete class")),
  });

  return (
    <section className="panel">
      <h3>Classes & sections</h3>
      <p className="muted">Define the academic structure students are enrolled into.</p>

      {canAdmin && (
        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (className.trim()) addClass.mutate(className.trim());
          }}
        >
          <input
            placeholder="New class (e.g. Grade 5)"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
          <button className="inline-btn" type="submit" disabled={addClass.isPending}>
            Add class
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {isLoading && <p className="muted">Loading…</p>}
      {data && data.length === 0 && <p className="muted">No classes yet.</p>}

      <div className="class-list">
        {data?.map((cls) => (
          <ClassRow
            key={cls.id}
            cls={cls}
            canAdmin={canAdmin}
            onChanged={invalidate}
            onDelete={() => deleteClass.mutate(cls.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ClassRow({
  cls,
  canAdmin,
  onChanged,
  onDelete,
}: {
  cls: ClassWithSections;
  canAdmin: boolean;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [sectionName, setSectionName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addSection = useMutation({
    mutationFn: (name: string) => api.post(`/classes/${cls.id}/sections`, { name }),
    onSuccess: () => {
      setSectionName("");
      setError(null);
      onChanged();
    },
    onError: (err) => setError(errMsg(err, "Could not add section")),
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/sections/${id}`),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (err) => setError(errMsg(err, "Could not delete section")),
  });

  return (
    <div className="class-card">
      <div className="class-head">
        <strong>{cls.name}</strong>
        {canAdmin && (
          <button className="link danger" onClick={onDelete} title="Delete class">
            Delete
          </button>
        )}
      </div>

      <div className="section-chips">
        {cls.sections.length === 0 && <span className="muted">No sections</span>}
        {cls.sections.map((s) => (
          <span className="chip" key={s.id}>
            {s.name} · {s._count.students}
            {canAdmin && (
              <button className="chip-x" onClick={() => deleteSection.mutate(s.id)} title="Delete section">
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {canAdmin && (
        <form
          className="add-row small"
          onSubmit={(e) => {
            e.preventDefault();
            if (sectionName.trim()) addSection.mutate(sectionName.trim());
          }}
        >
          <input
            placeholder="Section (e.g. A)"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
          />
          <button className="inline-btn ghost" type="submit" disabled={addSection.isPending}>
            Add section
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
