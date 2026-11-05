import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { RoleName } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { BadRequest, Conflict, NotFound, errorFromZod } from "../../lib/error";
import { logAudit, getIpAddress } from "../../lib/audit";

export const usersRouter = Router();
usersRouter.use(authenticate);
usersRouter.use(requirePermission("user:manage"));

const userSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { name: true } },
  branch: { select: { id: true, code: true, name: true } },
} as const;

const baseSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, "Username hanya huruf, angka, titik, garis bawah"),
  email: z.string().email(),
  fullName: z.string().min(3).max(120),
  role: z.nativeEnum(RoleName),
  branchId: z.string().nullable().optional(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
});

const updateSchema = baseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

function assertBranchForRole(role: RoleName, branchId: string | null | undefined) {
  if (role === "MR") {
    if (branchId) throw BadRequest("Role MR tidak terikat branch");
    return;
  }
  if (!branchId) throw BadRequest("Risk Officer dan Risk Owner wajib memiliki branch");
}

async function assertBranchExists(branchId: string | null | undefined) {
  if (!branchId) return;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw BadRequest("Branch tidak ditemukan");
  if (!branch.isActive) throw BadRequest("Branch tidak aktif");
}

/** GET /api/users */
usersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const role = req.query.role as RoleName | undefined;
    const branchId = req.query.branchId as string | undefined;
    const active = req.query.active as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));

    const where = {
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { fullName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
      ...(role ? { role: { name: role } } : {}),
      ...(branchId ? { branchId } : {}),
      ...(active === "true" ? { isActive: true } : active === "false" ? { isActive: false } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ role: { name: "asc" } }, { fullName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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

/** POST /api/users */
usersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const { password, ...input } = parsed.data;

    assertBranchForRole(input.role, input.branchId);
    await assertBranchExists(input.branchId);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: input.username }, { email: input.email }] },
      select: { username: true, email: true },
    });
    if (existing) {
      throw Conflict(existing.username === input.username ? "Username sudah dipakai" : "Email sudah dipakai");
    }

    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw BadRequest("Role tidak ditemukan");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        fullName: input.fullName,
        roleId: role.id,
        branchId: input.branchId ?? null,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
      },
      select: userSelect,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Membuat pengguna ${user.username} (${user.role.name})`,
      after: { username: user.username, role: user.role.name, branchId: input.branchId ?? null },
      ipAddress: getIpAddress(req),
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/users/:id */
usersRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const current = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { ...userSelect, roleId: true },
    });
    if (!current) throw NotFound("Pengguna tidak ditemukan");

    const nextRole = parsed.data.role ?? current.role.name;
    const nextBranch = parsed.data.branchId !== undefined ? parsed.data.branchId : current.branch?.id ?? null;
    assertBranchForRole(nextRole, nextBranch);
    await assertBranchExists(nextBranch);

    if (parsed.data.username || parsed.data.email) {
      const dupe = await prisma.user.findFirst({
        where: {
          id: { not: current.id },
          OR: [
            ...(parsed.data.username ? [{ username: parsed.data.username }] : []),
            ...(parsed.data.email ? [{ email: parsed.data.email }] : []),
          ],
        },
        select: { username: true, email: true },
      });
      if (dupe) throw Conflict(dupe.username === parsed.data.username ? "Username sudah dipakai" : "Email sudah dipakai");
    }

    if (current.id === req.user!.id && parsed.data.isActive === false) {
      throw BadRequest("Tidak dapat menonaktifkan akun sendiri");
    }

    const role = parsed.data.role
      ? await prisma.role.findUnique({ where: { name: parsed.data.role } })
      : null;
    if (parsed.data.role && !role) throw BadRequest("Role tidak ditemukan");

    const user = await prisma.user.update({
      where: { id: current.id },
      data: {
        ...(parsed.data.username ? { username: parsed.data.username } : {}),
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
        ...(parsed.data.fullName ? { fullName: parsed.data.fullName } : {}),
        ...(role ? { roleId: role.id } : {}),
        ...(parsed.data.branchId !== undefined ? { branchId: parsed.data.branchId } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      select: userSelect,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: user.id,
      description: `Memperbarui pengguna ${user.username}`,
      before: { username: current.username, role: current.role.name, isActive: current.isActive },
      after: { username: user.username, role: user.role.name, isActive: user.isActive },
      ipAddress: getIpAddress(req),
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/** POST /api/users/:id/reset-password */
usersRouter.post("/:id/reset-password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ password: z.string().min(8).max(72).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, username: true } });
    if (!current) throw NotFound("Pengguna tidak ditemukan");

    const temporaryPassword = parsed.data.password ?? `Jxb${crypto.randomBytes(4).toString("hex")}!`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await prisma.user.update({
      where: { id: current.id },
      data: { passwordHash, mustChangePassword: true },
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: "USER_RESET_PASSWORD",
      entityType: "User",
      entityId: current.id,
      description: `Reset password pengguna ${current.username}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ temporaryPassword });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/users/:id/status */
usersRouter.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    if (req.params.id === req.user!.id && !parsed.data.isActive) {
      throw BadRequest("Tidak dapat menonaktifkan akun sendiri");
    }

    const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, username: true } });
    if (!current) throw NotFound("Pengguna tidak ditemukan");

    const user = await prisma.user.update({
      where: { id: current.id },
      data: { isActive: parsed.data.isActive },
      select: userSelect,
    });

    const actor = req.user!;
    await logAudit({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      branchId: actor.branchId,
      action: parsed.data.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
      entityType: "User",
      entityId: current.id,
      description: `${parsed.data.isActive ? "Mengaktifkan" : "Menonaktifkan"} pengguna ${current.username}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});
