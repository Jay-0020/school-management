import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";
import { countWorkingDays, dateKey, distanceMeters, utcMidnight } from "../../lib/calendar";

export const staffAttendanceRouter = Router();

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "DEAN", "ACCOUNTANT", "TEACHER"] as const;

/** Working days from session start to today (the attendance-% denominator). */
export async function workingDaysToDate(): Promise<{ days: number; start: Date | null }> {
  const s = await prisma.schoolSettings.findFirst();
  if (!s?.sessionStart) return { days: 0, start: null };
  const holidays = await prisma.holiday.findMany();
  const keys = new Set(holidays.map((h) => dateKey(h.date)));
  const today = utcMidnight(new Date());
  const sessionEnd = s.sessionEnd ? utcMidnight(s.sessionEnd) : today;
  const end = today < sessionEnd ? today : sessionEnd;
  const start = utcMidnight(s.sessionStart);
  if (start > end) return { days: 0, start };
  return { days: countWorkingDays(start, end, s.saturdayRule, keys), start };
}

const checkinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Staff self check-in. Server re-validates the geofence — the client button
 *  is only a convenience; this is the real guard. */
staffAttendanceRouter.post(
  "/checkin",
  authenticate,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = checkinSchema.parse(req.body);
    const s = await prisma.schoolSettings.findFirst();
    if (s?.latitude == null || s?.longitude == null) {
      throw ApiError.badRequest("Campus location is not configured yet.");
    }
    const dist = distanceMeters(latitude, longitude, s.latitude, s.longitude);
    if (dist > s.geofenceRadius) {
      throw ApiError.forbidden(
        `You are not on campus (${Math.round(dist)} m away, allowed ${s.geofenceRadius} m).`
      );
    }
    const date = utcMidnight(new Date());
    const record = await prisma.staffAttendance.upsert({
      where: { userId_date: { userId: req.user!.sub, date } },
      update: { checkInAt: new Date(), latitude, longitude },
      create: { userId: req.user!.sub, date, latitude, longitude },
    });
    res.json({ ok: true, distance: Math.round(dist), checkInAt: record.checkInAt });
  })
);

/** My own check-in status + attendance summary. */
staffAttendanceRouter.get(
  "/me",
  authenticate,
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const date = utcMidnight(new Date());
    const today = await prisma.staffAttendance.findUnique({
      where: { userId_date: { userId: req.user!.sub, date } },
    });
    const { days, start } = await workingDaysToDate();
    const attended = start
      ? await prisma.staffAttendance.count({
          where: { userId: req.user!.sub, date: { gte: start, lte: date } },
        })
      : 0;
    res.json({
      checkedInToday: !!today,
      checkInAt: today?.checkInAt ?? null,
      attended,
      workingDays: days,
      percentage: days ? Math.round((attended / days) * 100) : null,
    });
  })
);

/** All staff with their attendance % — Dean / Admin oversight. */
staffAttendanceRouter.get(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN"),
  asyncHandler(async (_req, res) => {
    const { days, start } = await workingDaysToDate();
    const today = utcMidnight(new Date());

    const teachers = await prisma.teacher.findMany({
      where: { userId: { not: null } },
      select: { employeeNo: true, firstName: true, lastName: true, staffType: true, userId: true },
      orderBy: { employeeNo: "asc" },
    });

    // Per-user attended counts (one query) + today's check-ins (one query).
    const counts = start
      ? await prisma.staffAttendance.groupBy({
          by: ["userId"],
          _count: { _all: true },
          where: { date: { gte: start, lte: today } },
        })
      : [];
    const attendedBy = new Map(counts.map((c) => [c.userId, c._count._all]));
    const checkedInToday = new Set(
      (await prisma.staffAttendance.findMany({ where: { date: today }, select: { userId: true } })).map(
        (r) => r.userId
      )
    );

    const staff = teachers.map((t) => {
      const attended = attendedBy.get(t.userId!) ?? 0;
      return {
        employeeNo: t.employeeNo,
        name: `${t.firstName} ${t.lastName}`,
        staffType: t.staffType,
        attended,
        workingDays: days,
        percentage: days ? Math.round((attended / days) * 100) : null,
        present: checkedInToday.has(t.userId!),
      };
    });

    res.json({ workingDays: days, staff });
  })
);
