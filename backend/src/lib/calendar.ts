// Academic-calendar + geofence helpers (working-day counting, holiday rules,
// and distance for staff on-campus check-in).
import type { SaturdayRule } from "@prisma/client";

/** Normalise any date to UTC midnight (day granularity). */
export function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** 'YYYY-MM-DD' key for a UTC-midnight date. */
export function dateKey(d: Date): string {
  return utcMidnight(d).toISOString().slice(0, 10);
}

/**
 * The UTC-midnight Date for the CURRENT CIVIL DATE in the given IANA timezone.
 * `utcMidnight(new Date())` keys by the UTC day, so for IST (UTC+5:30) any
 * instant between 00:00–05:30 local lands on the *previous* day — a check-in at
 * 1 AM IST would be recorded for yesterday. Computing the civil date in the
 * school's timezone first fixes that. Used for "today" in attendance.
 */
export function todayInZone(timeZone: string, now: Date = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD" in the target zone
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Which Saturday of the month a date is (1st, 2nd, …). */
function nthWeekdayOfMonth(d: Date): number {
  return Math.ceil(d.getUTCDate() / 7);
}

/**
 * Is `date` a non-working day? Sundays always are; Saturdays depend on the
 * rule; any date in `holidayKeys` (explicit holidays) is too.
 */
export function isHoliday(
  date: Date,
  saturdayRule: SaturdayRule,
  holidayKeys: Set<string>
): boolean {
  const dow = date.getUTCDay(); // 0 = Sun … 6 = Sat
  if (dow === 0) return true; // Sundays are always holidays
  if (dow === 6) {
    if (saturdayRule === "ALL") return true;
    if (saturdayRule === "ALTERNATE") {
      const nth = nthWeekdayOfMonth(date);
      if (nth === 2 || nth === 4) return true;
    }
  }
  return holidayKeys.has(dateKey(date));
}

/** Count working days in [start, end] inclusive. */
export function countWorkingDays(
  start: Date,
  end: Date,
  saturdayRule: SaturdayRule,
  holidayKeys: Set<string>
): number {
  const last = utcMidnight(end);
  let count = 0;
  for (const d = utcMidnight(start); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    if (!isHoliday(d, saturdayRule, holidayKeys)) count++;
  }
  return count;
}

/** Great-circle distance in metres between two lat/lng points (haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // earth radius, metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
