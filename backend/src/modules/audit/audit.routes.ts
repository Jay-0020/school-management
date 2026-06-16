import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
import { authenticate, requireRole } from "../../middleware/auth";

export const auditRouter = Router();

auditRouter.use(authenticate);

/** Read-only audit trail (Admin / Super-Admin). Filter by text / action / date. */
auditRouter.get(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 50);
    const where: Prisma.AuditLogWhereInput = {};

    if (req.query.action) where.action = { startsWith: String(req.query.action) };
    if (req.query.q) {
      const q = String(req.query.q);
      where.OR = [
        { summary: { contains: q, mode: "insensitive" } },
        { actorEmail: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
      ];
    }
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
      if (req.query.to) {
        const to = new Date(String(req.query.to));
        to.setUTCDate(to.getUTCDate() + 1); // inclusive of the 'to' day
        where.createdAt.lt = to;
      }
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);
