import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";

export const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.use(requirePermission("audit:view"));

/** GET /api/audit */
auditRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const action = (req.query.action as string | undefined)?.trim();
    const entityType = (req.query.entityType as string | undefined)?.trim();
    const actorId = req.query.actorId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const createdAt =
      from || to
        ? {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          }
        : undefined;

    const where = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q } },
              { actorName: { contains: q } },
              { action: { contains: q } },
              { entityType: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          actorId: true,
          actorName: true,
          actorRole: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          ipAddress: true,
          createdAt: true,
          branch: { select: { code: true, name: true } },
        },
      }),
    ]);

    res.json({
      data,
      meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/audit/actions - daftar aksi unik untuk filter */
auditRouter.get("/actions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    });
    const entities = await prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    });
    res.json({
      actions: rows.map((r) => r.action),
      entityTypes: entities.map((e) => e.entityType),
    });
  } catch (err) {
    next(err);
  }
});
