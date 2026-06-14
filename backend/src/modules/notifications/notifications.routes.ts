import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/http";
import { authenticate } from "../../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    res.json({ items, unread });
  })
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  })
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { read: true },
    });
    res.json({ ok: true });
  })
);
