import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { BadRequest, Conflict, NotFound, errorFromZod } from "../../lib/error";
import { logAudit, getIpAddress } from "../../lib/audit";

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);
categoriesRouter.use(requirePermission("category:manage"));

const select = {
  id: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { risks: true } },
} as const;

const createSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, "Kode hanya huruf, angka, dan tanda hubung"),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

/** GET /api/master/categories */
categoriesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const active = req.query.active as string | undefined;
    const data = await prisma.riskCategory.findMany({
      where: {
        ...(q ? { OR: [{ code: { contains: q } }, { name: { contains: q } }] } : {}),
        ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
      },
      select,
      orderBy: { code: "asc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** POST /api/master/categories */
categoriesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const code = parsed.data.code.toUpperCase();

    const existing = await prisma.riskCategory.findUnique({ where: { code } });
    if (existing) throw Conflict("Kode kategori sudah dipakai");

    const category = await prisma.riskCategory.create({
      data: { code, name: parsed.data.name, description: parsed.data.description },
      select,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "CATEGORY_CREATE",
      entityType: "RiskCategory",
      entityId: category.id,
      description: `Membuat kategori ${category.code} - ${category.name}`,
      after: { code: category.code, name: category.name },
      ipAddress: getIpAddress(req),
    });

    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/master/categories/:id */
categoriesRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const current = await prisma.riskCategory.findUnique({ where: { id: req.params.id } });
    if (!current) throw NotFound("Kategori tidak ditemukan");

    if (parsed.data.code) {
      const code = parsed.data.code.toUpperCase();
      const dupe = await prisma.riskCategory.findFirst({ where: { code, id: { not: current.id } } });
      if (dupe) throw Conflict("Kode kategori sudah dipakai");
    }

    const category = await prisma.riskCategory.update({
      where: { id: current.id },
      data: {
        ...(parsed.data.code ? { code: parsed.data.code.toUpperCase() } : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      select,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "CATEGORY_UPDATE",
      entityType: "RiskCategory",
      entityId: category.id,
      description: `Memperbarui kategori ${category.code}`,
      before: { code: current.code, name: current.name, isActive: current.isActive },
      after: { code: category.code, name: category.name, isActive: category.isActive },
      ipAddress: getIpAddress(req),
    });

    res.json({ category });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/master/categories/:id/status */
categoriesRouter.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const current = await prisma.riskCategory.findUnique({ where: { id: req.params.id } });
    if (!current) throw NotFound("Kategori tidak ditemukan");
    if (!parsed.data.isActive) {
      const activeRisks = await prisma.risk.count({
        where: { categoryId: current.id, deletedAt: null, status: { notIn: ["CLOSED", "REJECTED"] } },
      });
      if (activeRisks > 0) throw BadRequest("Tidak dapat menonaktifkan kategori yang masih dipakai risiko aktif");
    }

    const category = await prisma.riskCategory.update({
      where: { id: current.id },
      data: { isActive: parsed.data.isActive },
      select,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: parsed.data.isActive ? "CATEGORY_ACTIVATE" : "CATEGORY_DEACTIVATE",
      entityType: "RiskCategory",
      entityId: category.id,
      description: `${parsed.data.isActive ? "Mengaktifkan" : "Menonaktifkan"} kategori ${category.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ category });
  } catch (err) {
    next(err);
  }
});
