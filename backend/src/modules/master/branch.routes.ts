import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { BadRequest, Conflict, NotFound, errorFromZod } from "../../lib/error";
import { logAudit, getIpAddress } from "../../lib/audit";

export const branchesRouter = Router();
branchesRouter.use(authenticate);
branchesRouter.use(requirePermission("branch:manage"));

const select = {
  id: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, risks: true } },
} as const;

const createSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, "Kode hanya huruf, angka, dan tanda hubung"),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

/** GET /api/master/branches */
branchesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const active = req.query.active as string | undefined;
    const data = await prisma.branch.findMany({
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

/** POST /api/master/branches */
branchesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const code = parsed.data.code.toUpperCase();

    const existing = await prisma.branch.findUnique({ where: { code } });
    if (existing) throw Conflict("Kode branch sudah dipakai");

    const branch = await prisma.branch.create({
      data: { code, name: parsed.data.name, description: parsed.data.description },
      select,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "BRANCH_CREATE",
      entityType: "Branch",
      entityId: branch.id,
      description: `Membuat branch ${branch.code} - ${branch.name}`,
      after: { code: branch.code, name: branch.name },
      ipAddress: getIpAddress(req),
    });

    res.status(201).json({ branch });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/master/branches/:id */
branchesRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const current = await prisma.branch.findUnique({ where: { id: req.params.id } });
    if (!current) throw NotFound("Branch tidak ditemukan");

    if (parsed.data.code) {
      const code = parsed.data.code.toUpperCase();
      const dupe = await prisma.branch.findFirst({ where: { code, id: { not: current.id } } });
      if (dupe) throw Conflict("Kode branch sudah dipakai");
    }

    const branch = await prisma.branch.update({
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
      action: "BRANCH_UPDATE",
      entityType: "Branch",
      entityId: branch.id,
      description: `Memperbarui branch ${branch.code}`,
      before: { code: current.code, name: current.name, isActive: current.isActive },
      after: { code: branch.code, name: branch.name, isActive: branch.isActive },
      ipAddress: getIpAddress(req),
    });

    res.json({ branch });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/master/branches/:id/status */
branchesRouter.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const current = await prisma.branch.findUnique({ where: { id: req.params.id } });
    if (!current) throw NotFound("Branch tidak ditemukan");
    if (!parsed.data.isActive) {
      const activeUsers = await prisma.user.count({ where: { branchId: current.id, isActive: true } });
      if (activeUsers > 0) throw BadRequest("Tidak dapat menonaktifkan branch yang masih memiliki pengguna aktif");
    }

    const branch = await prisma.branch.update({
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
      action: parsed.data.isActive ? "BRANCH_ACTIVATE" : "BRANCH_DEACTIVATE",
      entityType: "Branch",
      entityId: branch.id,
      description: `${parsed.data.isActive ? "Mengaktifkan" : "Menonaktifkan"} branch ${branch.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ branch });
  } catch (err) {
    next(err);
  }
});
