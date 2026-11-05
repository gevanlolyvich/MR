import { Router, NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { NotFound } from "../../lib/error";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    void fn(req, res, next).catch(next);

/** GET /api/notifications?unread=true&limit=15 */
notificationsRouter.get(
  "/",
  wrap(async (req, res) => {
    const user = req.user!;
    const unreadOnly = req.query.unread === "true";
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 15)));

    const [data, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    res.json({ data, unread });
  }),
);

/** POST /api/notifications/:id/read */
notificationsRouter.post(
  "/:id/read",
  wrap(async (req, res) => {
    const user = req.user!;
    const found = await prisma.notification.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!found) throw NotFound("Notifikasi tidak ditemukan");
    const updated = await prisma.notification.update({ where: { id: found.id }, data: { isRead: true } });
    res.json({ notification: updated });
  }),
);

/** POST /api/notifications/read-all */
notificationsRouter.post(
  "/read-all",
  wrap(async (req, res) => {
    const user = req.user!;
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    res.json({ message: "Semua notifikasi ditandai sudah dibaca" });
  }),
);
