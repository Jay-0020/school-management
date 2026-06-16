import { Router } from "express";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const ratingsRouter = Router();

ratingsRouter.use(authenticate);

interface RateableTeacher {
  id: string;
  name: string;
  employeeNo: string;
  subjects: Set<string>;
}

/** Teachers the current student/parent may rate = everyone assigned to teach
 *  their section(s), plus the section's class teacher. */
async function rateableTeachers(userId: string, role: Role): Promise<Map<string, RateableTeacher>> {
  let sectionIds: string[] = [];
  if (role === "STUDENT") {
    const s = await prisma.student.findUnique({ where: { userId }, select: { sectionId: true } });
    if (s?.sectionId) sectionIds = [s.sectionId];
  } else if (role === "PARENT") {
    const kids = await prisma.student.findMany({
      where: { parentId: userId },
      select: { sectionId: true },
    });
    sectionIds = [...new Set(kids.map((k) => k.sectionId).filter(Boolean) as string[])];
  }
  const map = new Map<string, RateableTeacher>();
  if (!sectionIds.length) return map;

  const [assigns, sections] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { sectionId: { in: sectionIds } },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        subject: { select: { name: true } },
      },
    }),
    prisma.section.findMany({
      where: { id: { in: sectionIds } },
      include: {
        classTeacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      },
    }),
  ]);

  const add = (
    t: { id: string; firstName: string; lastName: string; employeeNo: string } | null,
    subj: string
  ) => {
    if (!t) return;
    const e =
      map.get(t.id) ??
      { id: t.id, name: `${t.firstName} ${t.lastName}`, employeeNo: t.employeeNo, subjects: new Set<string>() };
    if (subj) e.subjects.add(subj);
    map.set(t.id, e);
  };
  for (const a of assigns) add(a.teacher, a.subject.name);
  for (const s of sections) add(s.classTeacher, "Class Teacher");
  return map;
}

// ── Student / parent: the teachers I can rate + my current rating ────────────
ratingsRouter.get(
  "/rateable",
  requireRole("STUDENT", "PARENT"),
  asyncHandler(async (req, res) => {
    const { sub, role } = req.user!;
    const map = await rateableTeachers(sub, role);
    const mine = await prisma.teacherRating.findMany({
      where: { raterId: sub },
      select: { teacherId: true, stars: true, comment: true },
    });
    const mineMap = new Map(mine.map((r) => [r.teacherId, r]));
    res.json({
      items: [...map.values()].map((t) => ({
        teacherId: t.id,
        name: t.name,
        employeeNo: t.employeeNo,
        subjects: [...t.subjects],
        myStars: mineMap.get(t.id)?.stars ?? null,
        myComment: mineMap.get(t.id)?.comment ?? null,
      })),
    });
  })
);

const rateSchema = z.object({
  teacherId: z.string(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().nullish(),
});

ratingsRouter.post(
  "/",
  requireRole("STUDENT", "PARENT"),
  asyncHandler(async (req, res) => {
    const { sub, role } = req.user!;
    const { teacherId, stars, comment } = rateSchema.parse(req.body);
    const map = await rateableTeachers(sub, role);
    if (!map.has(teacherId)) throw ApiError.forbidden("You can only rate your own teachers");
    const rating = await prisma.teacherRating.upsert({
      where: { raterId_teacherId: { raterId: sub, teacherId } },
      update: { stars, comment: comment ?? null },
      create: { teacherId, raterId: sub, raterRole: role, stars, comment: comment ?? null },
    });
    res.json(rating);
  })
);

// ── Teacher: my own rating (anonymous) ───────────────────────────────────────
ratingsRouter.get(
  "/me",
  requireRole("TEACHER"),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.sub } });
    if (!teacher) return res.json({ average: null, count: 0, comments: [] });
    const agg = await prisma.teacherRating.aggregate({
      where: { teacherId: teacher.id },
      _avg: { stars: true },
      _count: { _all: true },
    });
    const comments = await prisma.teacherRating.findMany({
      where: { teacherId: teacher.id, comment: { not: null } },
      select: { stars: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({
      average: agg._avg.stars ? Math.round(agg._avg.stars * 10) / 10 : null,
      count: agg._count._all,
      comments,
    });
  })
);

// ── Dean / Admin: teacher performance ────────────────────────────────────────
ratingsRouter.get(
  "/teachers",
  requireRole("SUPER_ADMIN", "ADMIN", "DEAN"),
  asyncHandler(async (_req, res) => {
    const grouped = await prisma.teacherRating.groupBy({
      by: ["teacherId"],
      _avg: { stars: true },
      _count: { _all: true },
    });
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: grouped.map((g) => g.teacherId) } },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    });
    const tmap = new Map(teachers.map((t) => [t.id, t]));
    const rows = grouped
      .map((g) => {
        const t = tmap.get(g.teacherId);
        return {
          teacherId: g.teacherId,
          name: t ? `${t.firstName} ${t.lastName}` : "—",
          employeeNo: t?.employeeNo ?? "",
          average: g._avg.stars ? Math.round(g._avg.stars * 10) / 10 : 0,
          count: g._count._all,
        };
      })
      .sort((a, b) => b.average - a.average);

    const comments = await prisma.teacherRating.findMany({
      where: { comment: { not: null } },
      select: {
        stars: true,
        comment: true,
        createdAt: true,
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json({
      teachers: rows,
      comments: comments.map((c) => ({
        teacher: `${c.teacher.firstName} ${c.teacher.lastName}`,
        stars: c.stars,
        comment: c.comment,
        createdAt: c.createdAt,
      })),
    });
  })
);
