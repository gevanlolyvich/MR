import { Prisma, RoleName } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface AuditOptions {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: RoleName | null;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

export function getIpAddress(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return fwd || req.socket?.remoteAddress || null;
}

export async function logAudit(opts: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: opts.actorId ?? undefined,
        actorName: opts.actorName ?? undefined,
        actorRole: opts.actorRole ?? undefined,
        branchId: opts.branchId ?? undefined,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? undefined,
        description: opts.description ?? undefined,
        before: opts.before ?? undefined,
        after: opts.after ?? undefined,
        ipAddress: opts.ipAddress ?? undefined,
      },
    });
  } catch (err) {
    // Audit log tidak boleh menggagalkan operasi utama, tapi tetap dilaporkan.
    console.error("[audit] Gagal mencatat audit log:", err);
  }
}
