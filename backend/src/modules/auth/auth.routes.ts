import { Router, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, signToken, setAuthCookie, TOKEN_COOKIE } from "../../middleware/auth";
import { Unauthorized, BadRequest, errorFromZod } from "../../lib/error";
import { logAudit, getIpAddress } from "../../lib/audit";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak percobaan login. Coba lagi dalam 1 menit." },
});

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

function profileOf(row: {
  id: string; username: string; email: string; fullName: string;
  mustChangePassword: boolean; roleId: string;
  role: { name: string; permissions: { permission: { code: string } }[] };
  branch: { id: string; code: string; name: string } | null;
  lastLoginAt: Date | null;
}) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    role: row.role.name,
    permissions: row.role.permissions.map((p) => p.permission.code),
    branch: row.branch ? { id: row.branch.id, code: row.branch.code, name: row.branch.name } : null,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
  };
}

authRouter.post(
  "/login",
  loginLimiter,
  async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) throw errorFromZod(parsed.error);

      const identifier = parsed.data.username.trim();
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: identifier }, { email: identifier }],
          deletedAt: null,
        },
        include: {
          role: { include: { permissions: { select: { permission: { select: { code: true } } } } } },
          branch: { select: { id: true, code: true, name: true } },
        },
      });

      const valid =
        user &&
        user.isActive &&
        (await bcrypt.compare(parsed.data.password, user.passwordHash));

      if (!user || !valid) {
        throw Unauthorized("Username atau password salah");
      }

      const token = signToken({ sub: user.id, role: user.role.name });
      setAuthCookie(res, token);
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      await logAudit({
        actorId: user.id,
        actorName: user.username,
        actorRole: user.role.name,
        branchId: user.branchId,
        action: "LOGIN",
        entityType: "USER",
        entityId: user.id,
        description: "Login ke sistem",
        ipAddress: getIpAddress(req),
      });

      res.json({ token, user: profileOf(user) });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/logout",
  authenticate,
  async (req, res, next) => {
    try {
      const user = req.user!;
      await logAudit({
        actorId: user.id, actorName: user.username, actorRole: user.role,
        branchId: user.branchId, action: "LOGOUT", entityType: "USER", entityId: user.id,
        description: "Logout dari sistem", ipAddress: getIpAddress(req),
      });
      res.clearCookie(TOKEN_COOKIE, { path: "/" });
      res.json({ message: "Logout berhasil" });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.get(
  "/me",
  authenticate,
  async (req, res, next) => {
    try {
      const row = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          role: { include: { permissions: { select: { permission: { select: { code: true } } } } } },
          branch: { select: { id: true, code: true, name: true } },
        },
      });
      if (!row) throw Unauthorized();
      res.json({ user: profileOf(row) });
    } catch (err) {
      next(err);
    }
  },
);

/** Ubah password sendiri (wajib ketika mustChangePassword). */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password minimal 8 karakter"),
});

authRouter.post(
  "/change-password",
  authenticate,
  async (req, res, next) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) throw errorFromZod(parsed.error);

      const row = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          role: { include: { permissions: { select: { permission: { select: { code: true } } } } } },
          branch: { select: { id: true, code: true, name: true } },
        },
      });
      if (!row) throw Unauthorized();
      const ok = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
      if (!ok) throw BadRequest("Password saat ini salah");

      const hash = await bcrypt.hash(parsed.data.newPassword, 10);
      await prisma.user.update({
        where: { id: row.id },
        data: { passwordHash: hash, mustChangePassword: false },
      });

      await logAudit({
        actorId: row.id, actorName: row.username, actorRole: row.role?.name ?? null,
        branchId: row.branchId, action: "CHANGE_PASSWORD",
        entityType: "USER", entityId: row.id,
        description: "User mengubah password sendiri",
        ipAddress: getIpAddress(req),
      });

      res.json({ message: "Password berhasil diubah" });
    } catch (err) {
      next(err);
    }
  },
);
