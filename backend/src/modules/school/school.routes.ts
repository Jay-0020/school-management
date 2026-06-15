import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { countWorkingDays, dateKey, utcMidnight } from "../../lib/calendar";

export const schoolRouter = Router();

/**
 * Public branding — the SPA fetches this before login to theme the app
 * (name, logo, colour). Drives the white-label experience.
 */
schoolRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await prisma.schoolSettings.findFirst();
    if (!settings) throw ApiError.notFound("School not configured");
    res.json({
      name: settings.name,
      shortName: settings.shortName,
      primaryColor: settings.primaryColor,
      logoUrl: settings.logoUrl,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      currency: settings.currency,
      timezone: settings.timezone,
      academicYear: settings.academicYear,
      // Geofence — needed by staff check-in (the secret is enforced server-side).
      latitude: settings.latitude,
      longitude: settings.longitude,
      geofenceRadius: settings.geofenceRadius,
    });
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  primaryColor: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  // Nullable columns — accept null to clear them.
  shortName: z.string().nullish(),
  logoUrl: z.string().nullish(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  academicYear: z.string().nullish(),
  // Geofence — Admin sets the school's location + radius (metres).
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  geofenceRadius: z.number().int().positive().max(100000).optional(),
});

schoolRouter.put(
  "/settings",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const settings = await prisma.schoolSettings.update({ where: { id: 1 }, data });
    res.json(settings);
  })
);

// ── Academic calendar ──────────────────────────────────────────────────────

/** Full calendar — session range, Saturday rule, holidays, working-day counts.
 *  Readable by any signed-in user (shown read-only on every dashboard). */
schoolRouter.get(
  "/calendar",
  authenticate,
  asyncHandler(async (_req, res) => {
    const s = await prisma.schoolSettings.findFirst();
    if (!s) throw ApiError.notFound("School not configured");
    const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
    const holidayKeys = new Set(holidays.map((h) => dateKey(h.date)));

    let workingDays = 0;
    let workingDaysToDate = 0;
    if (s.sessionStart && s.sessionEnd) {
      workingDays = countWorkingDays(s.sessionStart, s.sessionEnd, s.saturdayRule, holidayKeys);
      const today = utcMidnight(new Date());
      const sessionEnd = utcMidnight(s.sessionEnd);
      const end = today < sessionEnd ? today : sessionEnd;
      if (utcMidnight(s.sessionStart) <= end) {
        workingDaysToDate = countWorkingDays(s.sessionStart, end, s.saturdayRule, holidayKeys);
      }
    }

    res.json({
      sessionStart: s.sessionStart,
      sessionEnd: s.sessionEnd,
      saturdayRule: s.saturdayRule,
      latitude: s.latitude,
      longitude: s.longitude,
      geofenceRadius: s.geofenceRadius,
      holidays: holidays.map((h) => ({ date: dateKey(h.date), note: h.note })),
      workingDays,
      workingDaysToDate,
    });
  })
);

const calendarSchema = z.object({
  sessionStart: z.string().nullish(),
  sessionEnd: z.string().nullish(),
  saturdayRule: z.enum(["NONE", "ALL", "ALTERNATE"]).optional(),
});

/** Update session range + Saturday rule. Admin + Dean. */
schoolRouter.put(
  "/calendar",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN"),
  asyncHandler(async (req, res) => {
    const b = calendarSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (b.sessionStart !== undefined)
      data.sessionStart = b.sessionStart ? utcMidnight(new Date(b.sessionStart)) : null;
    if (b.sessionEnd !== undefined)
      data.sessionEnd = b.sessionEnd ? utcMidnight(new Date(b.sessionEnd)) : null;
    if (b.saturdayRule !== undefined) data.saturdayRule = b.saturdayRule;
    const s = await prisma.schoolSettings.update({ where: { id: 1 }, data });
    res.json(s);
  })
);

const holidaySchema = z.object({
  date: z.string(), // 'YYYY-MM-DD' or ISO
  isHoliday: z.boolean(),
  note: z.string().nullish(),
});

/** Mark / unmark a single date as a holiday (with an optional notice note).
 *  Admin + Dean. Sundays can't be changed (always holidays). */
schoolRouter.post(
  "/calendar/holiday",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN"),
  asyncHandler(async (req, res) => {
    const b = holidaySchema.parse(req.body);
    const date = utcMidnight(new Date(b.date));
    if (Number.isNaN(date.getTime())) throw ApiError.badRequest("Invalid date");
    if (date.getUTCDay() === 0) throw ApiError.badRequest("Sundays are always holidays");

    if (b.isHoliday) {
      await prisma.holiday.upsert({
        where: { date },
        update: { note: b.note ?? null },
        create: { date, note: b.note ?? null },
      });
    } else {
      await prisma.holiday.deleteMany({ where: { date } });
    }
    res.json({ ok: true });
  })
);
