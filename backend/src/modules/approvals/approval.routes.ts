import { Router, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { BadRequest, Forbidden, NotFound, Unprocessable, errorFromZod } from "../../lib/error";
import { getIpAddress, logAudit } from "../../lib/audit";
import { RoleName } from "@prisma/client";

export const approvalsRouter = Router();
approvalsRouter.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    void fn(req, res, next).catch(next);

function requireInScope(user: { role: RoleName; branchId: string | null }, branchId: string) {
  if (user.role !== "MR" && user.branchId !== branchId) {
    throw Forbidden("Risiko ini di luar cakupan cabang Anda");
  }
}

async function notify(users: { id: string }[], payload: { title: string; message: string; type: string; link?: string }) {
  if (!users.length) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, ...payload })),
  });
}

async function findRisk(id: string) {
  const risk = await prisma.risk.findUnique({ where: { id }, include: { owner: { select: { id: true, fullName: true } } } });
  if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
  return risk;
}

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
  note: z.string().max(1000).optional(),
});

/** GET /api/approvals - antrean approval sesuai role */
approvalsRouter.get(
  "/",
  wrap(async (req, res) => {
    const user = req.user!;
    const riskWhere =
      user.role === "MR"
        ? { status: { in: ["PENDING_VALIDATION", "PENDING_VERIFICATION"] as ("PENDING_VALIDATION" | "PENDING_VERIFICATION")[] } }
        : user.role === "RISK_OFFICER"
          ? { status: "SUBMITTED" as const, branchId: user.branchId ?? "" }
          : { ownerId: user.id, status: { in: ["RETURNED", "REJECTED"] as ("RETURNED" | "REJECTED")[] } };

    const risks = await prisma.risk.findMany({
      where: { deletedAt: null, ...riskWhere },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true, code: true, title: true, status: true, updatedAt: true,
        inherentScore: true, inherentLevel: true, residualScore: true, residualLevel: true,
        branch: { select: { code: true, name: true } },
        category: { select: { name: true } },
        owner: { select: { fullName: true } },
      },
    });

    const mitigationWhere =
      user.role === "MR"
        ? { status: "PENDING_VERIFICATION" as const }
        : user.role === "RISK_OFFICER"
          ? { status: "PENDING_VERIFICATION" as const, risk: { branchId: user.branchId ?? "" } }
          : { id: "__none__" };

    const mitigations = await prisma.mitigationPlan.findMany({
      where: { deletedAt: null, ...mitigationWhere },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true, description: true, progress: true, status: true, dueDate: true,
        risk: { select: { id: true, code: true, title: true, branchId: true } },
        responsible: { select: { fullName: true } },
      },
    });

    res.json({ risks, mitigations, counts: { risks: risks.length, mitigations: mitigations.length } });
  }),
);

/** POST /api/approvals/:id/review - Risk Officer review risiko SUBMITTED */
approvalsRouter.post(
  "/:id/review",
  requirePermission("risk:review"),
  wrap(async (req, res) => {
    const user = req.user!;
    if (user.role === "RISK_OWNER") throw Forbidden("Risk Owner tidak dapat melakukan review");
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const { decision, note } = parsed.data;
    if (decision === "RETURN" && !note) throw BadRequest("Catatan revisi wajib diisi");

    const risk = await findRisk(req.params.id);
    requireInScope(user, risk.branchId);
    if (risk.status !== "SUBMITTED") throw Unprocessable(`Risiko berstatus ${risk.status} tidak dapat direview`);

    const toStatus = decision === "RETURN" ? "RETURNED" : "PENDING_VALIDATION";
    await prisma.$transaction([
      prisma.workflowApproval.create({
        data: {
          riskId: risk.id,
          action: decision === "RETURN" ? "RETURN_FOR_REVISION" : "REVIEW_APPROVE",
          fromStatus: risk.status,
          toStatus,
          note,
          actorId: user.id,
        },
      }),
      prisma.risk.update({ where: { id: risk.id }, data: { status: toStatus } }),
    ]);

    if (decision === "RETURN") {
      await notify([{ id: risk.ownerId }], {
        title: "Risiko perlu direvisi",
        message: `${risk.code} dikembalikan oleh Risk Officer. ${note ?? ""}`.trim(),
        type: "RISK_RETURNED",
        link: `/risks/${risk.id}`,
      });
    } else {
      const mrs = await prisma.user.findMany({ where: { isActive: true, deletedAt: null, role: { name: "MR" } }, select: { id: true } });
      await notify(mrs, {
        title: "Risiko menunggu validasi",
        message: `${risk.code} - ${risk.title} lolos review dan menunggu validasi MR`,
        type: "RISK_PENDING_VALIDATION",
        link: `/risks/${risk.id}`,
      });
    }

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: decision === "RETURN" ? "RETURN_FOR_REVISION" : "REVIEW_APPROVE", entityType: "RISK", entityId: risk.id,
      before: { status: risk.status }, after: { status: toStatus },
      description: `${decision === "RETURN" ? "Mengembalikan" : "Menyetujui review"} risiko ${risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ message: decision === "RETURN" ? "Risiko dikembalikan untuk revisi" : "Review disetujui" });
  }),
);

/** POST /api/approvals/:id/validate - MR validasi risiko PENDING_VALIDATION */
approvalsRouter.post(
  "/:id/validate",
  requirePermission("risk:validate"),
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const { decision, note } = parsed.data;
    if (decision === "RETURN") throw BadRequest("Gunakan keputusan APPROVE atau REJECT");

    const risk = await findRisk(req.params.id);
    if (risk.status !== "PENDING_VALIDATION") throw Unprocessable(`Risiko berstatus ${risk.status} tidak dapat divalidasi`);

    const approve = decision === "APPROVE";
    const toStatus = approve ? "ACTIVE" : "REJECTED";
    await prisma.$transaction([
      prisma.workflowApproval.create({
        data: {
          riskId: risk.id,
          action: approve ? "VALIDATE" : "VALIDATE_REJECT",
          fromStatus: risk.status,
          toStatus,
          note,
          actorId: user.id,
        },
      }),
      prisma.risk.update({ where: { id: risk.id }, data: { status: toStatus } }),
    ]);

    const officers = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null, role: { name: "RISK_OFFICER" }, branchId: risk.branchId },
      select: { id: true },
    });
    await notify([{ id: risk.ownerId }, ...officers], {
      title: approve ? "Risiko tervalidasi" : "Risiko ditolak MR",
      message: `${risk.code} ${approve ? "aktif dan siap masuk tahap mitigasi" : "ditolak pada validasi MR"}${note ? ` · ${note}` : ""}`,
      type: approve ? "RISK_ACTIVE" : "RISK_REJECTED",
      link: `/risks/${risk.id}`,
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: approve ? "VALIDATE" : "VALIDATE_REJECT", entityType: "RISK", entityId: risk.id,
      before: { status: risk.status }, after: { status: toStatus },
      description: `${approve ? "Memvalidasi" : "Menolak"} risiko ${risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ message: approve ? "Risiko divalidasi dan aktif" : "Risiko ditolak" });
  }),
);

/** POST /api/approvals/:id/submit-residual - owner ajukan residual utk verifikasi */
approvalsRouter.post(
  "/:id/submit-residual",
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = z.object({ note: z.string().max(1000).optional() }).safeParse(req.body ?? {});
    const note = parsed.success ? parsed.data.note : undefined;

    const risk = await findRisk(req.params.id);
    requireInScope(user, risk.branchId);
    const isOwner = risk.ownerId === user.id;
    if (!isOwner && user.role !== "MR") throw Forbidden("Hanya Risk Owner pemilik risiko yang dapat mengajukan residual");

    if (risk.status !== "ACTIVE") throw Unprocessable(`Risiko berstatus ${risk.status} tidak dapat diajukan residual`);
    if (risk.residualScore == null) throw BadRequest("Isi penilaian residual terlebih dahulu sebelum pengajuan");

    await prisma.$transaction([
      prisma.workflowApproval.create({
        data: {
          riskId: risk.id,
          action: "SUBMIT_RESIDUAL",
          fromStatus: risk.status,
          toStatus: "PENDING_VERIFICATION",
          note,
          actorId: user.id,
        },
      }),
      prisma.risk.update({ where: { id: risk.id }, data: { status: "PENDING_VERIFICATION" } }),
    ]);

    const mrs = await prisma.user.findMany({ where: { isActive: true, deletedAt: null, role: { name: "MR" } }, select: { id: true } });
    await notify(mrs, {
      title: "Residual menunggu verifikasi",
      message: `${risk.code} - ${risk.title} mengajukan verifikasi residual`,
      type: "RESIDUAL_SUBMITTED",
      link: `/risks/${risk.id}`,
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: "SUBMIT_RESIDUAL", entityType: "RISK", entityId: risk.id,
      before: { status: risk.status }, after: { status: "PENDING_VERIFICATION" },
      description: `Mengajukan verifikasi residual ${risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ message: "Residual diajukan untuk verifikasi" });
  }),
);

/** POST /api/approvals/:id/verify - MR verifikasi residual */
approvalsRouter.post(
  "/:id/verify",
  requirePermission("assessment:review"),
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const { decision, note } = parsed.data;
    if (decision === "RETURN") throw BadRequest("Gunakan keputusan APPROVE atau REJECT");

    const risk = await findRisk(req.params.id);
    if (risk.status !== "PENDING_VERIFICATION") throw Unprocessable(`Risiko berstatus ${risk.status} tidak dapat diverifikasi`);

    const approve = decision === "APPROVE";
    const toStatus = approve ? "CLOSED" : "ACTIVE";
    await prisma.$transaction([
      prisma.workflowApproval.create({
        data: {
          riskId: risk.id,
          action: approve ? "VERIFY" : "VERIFY_REJECT",
          fromStatus: risk.status,
          toStatus,
          note,
          actorId: user.id,
        },
      }),
      prisma.risk.update({ where: { id: risk.id }, data: { status: toStatus } }),
    ]);

    const officers = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null, role: { name: "RISK_OFFICER" }, branchId: risk.branchId },
      select: { id: true },
    });
    await notify([{ id: risk.ownerId }, ...officers], {
      title: approve ? "Risiko ditutup" : "Verifikasi residual ditolak",
      message: `${risk.code} ${approve ? "telah diverifikasi dan ditutup" : "perlu perbaikan residual"}${note ? ` · ${note}` : ""}`,
      type: approve ? "RISK_CLOSED" : "RESIDUAL_REJECTED",
      link: `/risks/${risk.id}`,
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: approve ? "VERIFY" : "VERIFY_REJECT", entityType: "RISK", entityId: risk.id,
      before: { status: risk.status }, after: { status: toStatus },
      description: `${approve ? "Memverifikasi" : "Menolak verifikasi"} risiko ${risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ message: approve ? "Risiko ditutup" : "Verifikasi residual ditolak" });
  }),
);

/** POST /api/approvals/:id/comment - catatan reviewer */
approvalsRouter.post(
  "/:id/comment",
  requirePermission("risk:review"),
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = z.object({ comment: z.string().min(3).max(2000), planId: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);

    const risk = await findRisk(req.params.id);
    requireInScope(user, risk.branchId);

    const comment = await prisma.reviewComment.create({
      data: {
        riskId: risk.id,
        planId: parsed.data.planId ?? null,
        authorId: user.id,
        authorRole: user.role,
        comment: parsed.data.comment,
      },
    });

    await notify([{ id: risk.ownerId }], {
      title: "Catatan baru dari reviewer",
      message: `${risk.code}: ${parsed.data.comment.slice(0, 140)}`,
      type: "REVIEW_COMMENT",
      link: `/risks/${risk.id}`,
    });

    res.status(201).json({ comment });
  }),
);

/** PATCH /api/approvals/comments/:commentId/resolve */
approvalsRouter.patch(
  "/comments/:commentId/resolve",
  wrap(async (req, res) => {
    const user = req.user!;
    const found = await prisma.reviewComment.findUnique({ where: { id: req.params.commentId }, include: { risk: true } });
    if (!found) throw NotFound("Catatan tidak ditemukan");
    if (user.role !== "MR" && found.authorId !== user.id) throw Forbidden("Tidak dapat menandai catatan ini");

    const updated = await prisma.reviewComment.update({
      where: { id: found.id },
      data: { isResolved: true },
    });
    res.json({ comment: updated });
  }),
);
