import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { Unauthorized, Forbidden } from "../lib/error";
import { RoleName } from "@prisma/client";

export const TOKEN_COOKIE = "jxbmr_token";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string;
  role: RoleName;
  branchId: string | null;
  permissions: string[];
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: { sub: string; role: string }) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) ?? "12h",
  });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = (req.cookies?.[TOKEN_COOKIE] as string) ?? bearer;
    if (!token) throw Unauthorized("Sesi berakhir, silakan login kembali");

    if (!req.cookies?.[TOKEN_COOKIE] && bearer) {
      // Bearer fallback tetap didukung untuk API testing.
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
    const row = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, username: true, email: true, fullName: true,
        isActive: true, mustChangePassword: true,
        roleId: true, role: { include: { permissions: { select: { permission: { select: { code: true } } } } } },
        branchId: true,
      },
    });

    if (!row || !row.isActive) throw Unauthorized("Akun tidak aktif");

    req.user = {
      id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.fullName,
      roleId: row.roleId,
      role: row.role.name,
      branchId: row.branchId,
      permissions: row.role.permissions.map((p) => p.permission.code),
      mustChangePassword: row.mustChangePassword,
    };
    next();
  } catch {
    next(Unauthorized("Sesi berakhir, silakan login kembali"));
  }
}

/** Memastikan user punya minimal salah satu permission yang disebut. */
export function requirePermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(Unauthorized());
    if (user.role === "MR" || codes.some((c) => user.permissions.includes(c))) return next();
    return next(Forbidden("Anda tidak memiliki izin untuk aksi ini"));
  };
}

/** Scope data: MR global; officer/owner terbatas branch miliknya sendiri. */
export function scopeTo(req: Request): { scope: "ALL" | "BRANCH"; branchId: string | null; explicitBranchId?: string } {
  const u = req.user!;
  if (u.role === "MR") {
    return { scope: "ALL", branchId: null, explicitBranchId: u.branchId ?? undefined };
  }
  return { scope: "BRANCH", branchId: u.branchId };
}
