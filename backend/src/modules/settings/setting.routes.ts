import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { errorFromZod } from "../../lib/error";
import { logAudit, getIpAddress } from "../../lib/audit";

export const settingsRouter = Router();
settingsRouter.use(authenticate);

/** GET /api/settings - dapat dibaca semua pengguna terautentikasi */
settingsRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
      select: { key: true, value: true, description: true, updatedAt: true },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/settings - hanya MR (settings:manage) */
settingsRouter.put("/", requirePermission("settings:manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z
      .object({
        settings: z.record(z.string()),
      })
      .safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const actor = req.user!;
    const entries = Object.entries(parsed.data.settings);

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value, updatedById: actor.id },
          create: { key, value, updatedById: actor.id },
        }),
      ),
    );

    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "SETTINGS_UPDATE",
      entityType: "SystemSetting",
      description: `Memperbarui ${entries.length} pengaturan sistem`,
      after: parsed.data.settings,
      ipAddress: getIpAddress(req),
    });

    const data = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
      select: { key: true, value: true, description: true, updatedAt: true },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
