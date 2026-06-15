import { useState } from "react";
import type { SchoolCalendar as Cal } from "../lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const nthSaturday = (day: number) => Math.ceil(day / 7);

interface Props {
  cal: Cal;
  readOnly?: boolean;
  onToggle?: (date: string, isHoliday: boolean, note: string | null) => void;
  saving?: boolean;
}

/** Month-grid academic calendar. Sundays + Saturday-rule + explicit holidays
 *  render green; editable mode lets Admin/Dean mark a date with a note. */
export function SchoolCalendar({ cal, readOnly, onToggle, saving }: Props) {
  const init = cal.sessionStart ? new Date(cal.sessionStart) : new Date();
  const [cursor, setCursor] = useState({ y: init.getUTCFullYear(), m: init.getUTCMonth() });
  const [picked, setPicked] = useState<{ date: string; note: string; explicit: boolean } | null>(null);

  const holidayMap = new Map(cal.holidays.map((h) => [h.date, h.note]));
  const sStart = cal.sessionStart ? cal.sessionStart.slice(0, 10) : null;
  const sEnd = cal.sessionEnd ? cal.sessionEnd.slice(0, 10) : null;
  const todayKey = new Date().toISOString().slice(0, 10);

  function status(y: number, m: number, d: number) {
    const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
    const k = keyOf(y, m, d);
    let holiday = false;
    let locked = false;
    let kind = "";
    if (dow === 0) {
      holiday = true;
      locked = true;
      kind = "Sunday";
    } else if (dow === 6 && cal.saturdayRule === "ALL") {
      holiday = true;
      kind = "Saturday off";
    } else if (dow === 6 && cal.saturdayRule === "ALTERNATE" && [2, 4].includes(nthSaturday(d))) {
      holiday = true;
      kind = "Saturday off";
    }
    const explicit = holidayMap.has(k);
    if (explicit) {
      holiday = true;
      kind = "Holiday";
    }
    const inSession = (!sStart || k >= sStart) && (!sEnd || k <= sEnd);
    return { dow, k, holiday, locked, explicit, note: holidayMap.get(k) ?? null, kind, inSession, isToday: k === todayKey };
  }

  const { y, m } = cursor;
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function step(delta: number) {
    setCursor((c) => {
      const nm = c.m + delta;
      return { y: c.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  function clickDay(d: number) {
    if (readOnly) return;
    const s = status(y, m, d);
    if (s.locked) return; // Sundays can't be changed
    setPicked({ date: s.k, note: s.note ?? "", explicit: s.explicit });
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <strong>{MONTHS[m]} {y}</strong>
        <button type="button" className="cal-nav" onClick={() => step(1)} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-wd">{w}</div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} className="cal-cell empty" />;
          const s = status(y, m, d);
          const cls = [
            "cal-cell",
            s.holiday ? "holiday" : "",
            !s.inSession ? "out" : "",
            s.isToday ? "today" : "",
            !readOnly && !s.locked ? "clickable" : "",
          ].join(" ").trim();
          return (
            <button
              type="button"
              key={d}
              className={cls}
              title={s.kind + (s.note ? `: ${s.note}` : "")}
              onClick={() => clickDay(d)}
              disabled={readOnly || s.locked}
            >
              <span className="cal-num">{d}</span>
              {s.note && <span className="cal-dot" />}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="sw holiday" /> Holiday</span>
        <span><i className="sw dot" /> Has notice</span>
        {!readOnly && <span className="muted">Tap a day to mark it a holiday</span>}
      </div>

      {picked && (
        <div className="cal-pop-backdrop" onClick={() => setPicked(null)}>
          <div className="cal-pop" onClick={(e) => e.stopPropagation()}>
            <h4>{new Date(picked.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</h4>
            <label>
              Notice (shown on the board the day before)
              <input
                value={picked.note}
                placeholder="e.g. Independence Day"
                onChange={(e) => setPicked({ ...picked, note: e.target.value })}
              />
            </label>
            <div className="cal-pop-actions">
              <button type="button" className="inline-btn ghost" onClick={() => setPicked(null)}>Cancel</button>
              {picked.explicit && (
                <button
                  type="button"
                  className="link danger"
                  disabled={saving}
                  onClick={() => { onToggle?.(picked.date, false, null); setPicked(null); }}
                >
                  Clear holiday
                </button>
              )}
              <button
                type="button"
                className="inline-btn"
                disabled={saving}
                onClick={() => { onToggle?.(picked.date, true, picked.note.trim() || null); setPicked(null); }}
              >
                Mark holiday
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
