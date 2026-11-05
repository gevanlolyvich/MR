import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { BadRequest, Forbidden, NotFound, Unprocessable, errorFromZod } from "../../lib/error";
import { logAudit } from "../../lib/audit";
import { riskLevel, riskScore, probImpactSchema } from "./risk-scores";
import { RoleName, RiskStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

export const risksRouter = Router();
risksRouter.use(authenticate);

const probImpact = probImpactSchema;

const createSchema = z.object({
  branchId: z.string().min(1),
  categoryId: z.string().min(1),
  ownerId: z.string().optional(),
  title: z.string().min(5, "Judul minimal 5 karakter").max(150),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").max(2000),
  causes: z.string().max(1000).optional(),
  impacts: z.string().max(1000).optional(),
  inherent: probImpact,
});

const updateSchema = z.object({
  branchId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  ownerId: z.string().optional(),
  title: z.string().min(5).max(150).optional(),
  description: z.string().min(10).max(2000).optional(),
  causes: z.string().max(1000).optional(),
  impacts: z.string().max(1000).optional(),
});

const assessmentSchema = z.object({
  type: z.enum(["INHERENT", "RESIDUAL"]),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  justification: z.string().max(1000).optional(),
});

const submitSchema = z.object({ note: z.string().max(500).optional() });

const SORT_FIELDS = [
  "code",
  "title",
  "createdAt",
  "updatedAt",
  "inherentScore",
  "inherentLevel",
  "status",
  "branch",
  "category",
] as const;

function scopeRisk(user: { role: RoleName; branchId: string | null }) {
  return user.role === "MR" ? {} : { branchId: user.branchId ?? "" };
}

function requireInScope(user: { role: RoleName; branchId: string | null }, branchId: string) {
  if (user.role !== "MR" && user.branchId !== branchId) {
    throw Forbidden("Risiko ini di luar cakupan cabang Anda");
  }
}

/** GET /api/risks - list dengan server-side pagination/filter/sort */
risksRouter.get("/", requirePermission("risk:view"), async (req, res, next) => {
  try {
    const user = req.user!;
    const q = (req.query.q as string | undefined)?.trim();
    const branchId = (req.query.branchId as string | undefined) || undefined;
    const categoryId = (req.query.categoryId as string | undefined) || undefined;
    const status = (req.query.status as string | undefined) || undefined;
    const level = (req.query.level as string | undefined) || undefined; // inherent level
    const levelField = (req.query.levelField as string | undefined) || "inherent";
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize ?? 10) || 10));
    const sortBy = (SORT_FIELDS as readonly string[]).includes(req.query.sortBy as string)
      ? (req.query.sortBy as string)
      : "createdAt";
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

    const where = {
      deletedAt: null,
      ...scopeRisk(user),
      ...(user.role === "MR" && branchId ? { branchId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status: status as RiskStatus } : {}),
      ...(() => {
        if (!level) return {};
        const key = levelField === "residual" ? "residualLevel" : "inherentLevel";
        return { [key]: level as never };
      })(),
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { title: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    };

    const orderByMap: Record<string, object> = {
      code: { code: sortDir },
      title: { title: sortDir },
      createdAt: { createdAt: sortDir },
      updatedAt: { updatedAt: sortDir },
      inherentScore: { inherentScore: sortDir },
      inherentLevel: { inherentScore: sortDir },
      status: { status: sortDir },
      branch: { branch: { code: sortDir } },
      category: { category: { name: sortDir } },
    };

    const [total, rows] = await Promise.all([
      prisma.risk.count({ where }),
      prisma.risk.findMany({
        where,
        orderBy: orderByMap[sortBy] ?? orderByMap.createdAt,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, code: true, title: true, status: true,
          inherentScore: true, inherentLevel: true,
          residualScore: true, residualLevel: true,
          residualProbability: true, residualImpact: true,
          createdAt: true, updatedAt: true,
          branch: { select: { id: true, code: true, name: true } },
          category: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    res.json({ data: rows, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    next(err);
  }
});

// Perbaikan middleware chain: parameter next pertama untuk async wrapper
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => void fn(req, res, next).catch(next);

/** POST /api/risks - create draft + inherent assessment */
risksRouter.post(
  "/",
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const body = parsed.data;
    requireInScope(user, body.branchId);

    // Owner enforce: Risk Owner hanya bisa utk cabangnya sendiri
    if (user.role === "RISK_OWNER" && body.branchId !== user.branchId) {
      throw Forbidden("Risiko hanya dapat dibuat pada cabang Anda");
    }

    const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
    if (!branch || !branch.isActive) throw BadRequest("Branch tidak aktif atau tidak ditemukan");
    const category = await prisma.riskCategory.findUnique({ where: { id: body.categoryId } });
    if (!category || !category.isActive) throw BadRequest("Kategori tidak valid");

    let ownerId = body.ownerId;
    if (!ownerId) {
      if (user.role !== "RISK_OWNER") throw BadRequest("Risk Owner wajib ditentukan");
      ownerId = user.id;
    } else {
      const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true, role: { name: "RISK_OWNER" } } });
      if (!owner) throw BadRequest("Risk Owner tidak valid");
      if (user.role === "RISK_OWNER" && owner.id !== user.id) throw Forbidden("Anda hanya dapat menugaskan diri sendiri");
      requireInScope(user, owner.branchId ?? "");
    }

    // Kode unik per branch: {BRANCHCODE}-Rxx
    const max = await prisma.risk.count({ where: { branchId: body.branchId, code: { contains: branch.code } } });
    let code = `${branch.code}-R${String(max + 1).padStart(2, "0")}`;
    let seq = max + 1;
    // pastikan unik dgn loop (aman utk race sederhana)
    while (await prisma.risk.findUnique({ where: { code } })) {
      seq++;
      code = `${branch.code}-R${String(seq).padStart(2, "0")}`;
    }

    const risk = await prisma.risk.create({
      data: {
        code,
        branchId: body.branchId,
        categoryId: body.categoryId,
        ownerId,
        createdById: user.id,
        title: body.title,
        description: body.description,
        causes: body.causes,
        impacts: body.impacts,
        status: "DRAFT",
        inherentProbability: body.inherent.probability,
        inherentImpact: body.inherent.impact,
        inherentScore: body.inherent.score,
        inherentLevel: body.inherent.level,
        assessments: {
          create: [
            {
              type: "INHERENT",
              probability: body.inherent.probability,
              impact: body.inherent.impact,
              score: body.inherent.score,
              level: body.inherent.level,
              justification: body.inherent.justification ?? "Penetapan awal saat identifikasi risiko",
              assessedById: user.id,
            },
          ],
        },
        histories: {
          create: [
            {
              type: "INHERENT",
              oldProbability: null,
              oldImpact: null,
              newProbability: body.inherent.probability,
              newImpact: body.inherent.impact,
              reason: "Penetapan awal inherent assessment",
              changedById: user.id,
            },
          ],
        },
      },
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: body.branchId,
      action: "CREATE", entityType: "RISK", entityId: risk.id,
      after: { code, title: risk.title },
      description: `Membuat risiko ${code}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? null,
    });

    res.status(201).json({ risk: { id: risk.id, code: risk.code } });
  }),
);

/** GET /api/risks/:id - detail lengkap */
risksRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const user = req.user!;
    const risk = await prisma.risk.findUnique({
      where: { id: req.params.id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        category: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        createdBy: { select: { fullName: true } },
        assessments: { orderBy: { createdAt: "desc" }, include: { assessedBy: { select: { fullName: true } } } },
        histories: { orderBy: { createdAt: "desc" }, take: 20, include: { changedBy: { select: { fullName: true } } } },
        approvals: { orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { fullName: true } } } },
        comments: { orderBy: { createdAt: "desc" }, include: { author: { select: { fullName: true } } } },
        mitigations: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { responsible: { select: { fullName: true } } },
        },
      },
    });
    if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
    requireInScope(user, risk.branchId);
    res.json({ risk });
  }),
);

/** PUT /api/risks/:id - update field utama */
risksRouter.put(
  "/:id",
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const risk = await prisma.risk.findUnique({ where: { id: req.params.id } });
    if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
    requireInScope(user, risk.branchId);

    const isOwner = user.role === "RISK_OWNER" && risk.ownerId === user.id;
    const canEdit = user.role === "MR" || isOwner;
    if (!canEdit) throw Forbidden("Hanya Risk Owner pemilik risiko atau MR yang dapat mengubah");

    if (!["DRAFT", "RETURNED", "REJECTED"].includes(risk.status)) {
      throw Unprocessable("Risiko hanya dapat diubah saat status Draft, Direvisi, atau Ditolak");
    }

    const body = parsed.data;
    const before = { title: risk.title, description: risk.description, causes: risk.causes, impacts: risk.impacts };
    const after = {
      ...before,
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.causes !== undefined ? { causes: body.causes } : {}),
      ...(body.impacts !== undefined ? { impacts: body.impacts } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    };
    if (body.categoryId) {
      const cat = await prisma.riskCategory.findUnique({ where: { id: body.categoryId } });
      if (!cat) throw BadRequest("Kategori tidak valid");
    }
    if (body.branchId && body.branchId !== risk.branchId) {
      requireInScope(user, body.branchId);
    }

    const updated = await prisma.risk.update({
      where: { id: risk.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.causes !== undefined ? { causes: body.causes } : {}),
        ...(body.impacts !== undefined ? { impacts: body.impacts } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
      },
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: "UPDATE", entityType: "RISK", entityId: risk.id,
      before, after,
      description: `Memperbarui risiko ${risk.code}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? null,
    });

    res.json({ risk: { id: updated.id, code: updated.code } });
  }),
);

/** POST /api/risks/:id/assessment - ubah nilai assessment (inherent/residual) */
risksRouter.post(
  "/:id/assessment",
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = assessmentSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const body = parsed.data;

    const risk = await prisma.risk.findUnique({ where: { id: req.params.id } });
    if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
    requireInScope(user, risk.branchId);

    const isOwner = user.role === "RISK_OWNER" && risk.ownerId === user.id;
    if (!isOwner && user.role !== "MR") throw Forbidden("Hanya Risk Owner atau MR dapat mengubah penilaian");

    if (["CLOSED"].includes(risk.status)) {
      throw Unprocessable("Risiko sudah ditutup, penilaian tidak dapat diubah");
    }
    if (body.type === "RESIDUAL" && ["DRAFT", "SUBMITTED", "RETURNED", "REJECTED"].includes(risk.status)) {
      throw Unprocessable("Residual assessment dapat diisi setelah risiko tervalidasi");
    }
    if (body.type === "INHERENT" && ["PENDING_VERIFICATION", "CLOSED"].includes(risk.status)) {
      throw Unprocessable("Inherent assessment sudah final pada tahap ini");
    }

    const col = body.type === "INHERENT" ? "inherent" : "residual";
    const oldP = body.type === "INHERENT" ? risk.inherentProbability : risk.residualProbability;
    const oldI = body.type === "INHERENT" ? risk.inherentImpact : risk.residualImpact;
    if (oldP === body.probability && oldI === body.impact) {
      throw Unprocessable("Nilai penilaian tidak berubah");
    }

    const updated = await prisma.risk.update({
      where: { id: risk.id },
      data: {
        ...(body.type === "INHERENT"
          ? {
              inherentProbability: body.probability,
              inherentImpact: body.impact,
              inherentScore: body.probability * body.impact,
              inherentLevel: riskLevel(body.probability * body.impact),
            }
          : {
              residualProbability: body.probability,
              residualImpact: body.impact,
              residualScore: body.probability * body.impact,
              residualLevel: riskLevel(body.probability * body.impact),
            }),
        assessments: {
          create: {
            type: body.type,
            probability: body.probability,
            impact: body.impact,
            score: body.probability * body.impact,
            level: riskLevel(body.probability * body.impact),
            justification: body.justification,
            assessedById: user.id,
          } as never,
        },
        histories: {
          create: {
            type: body.type,
            oldProbability: oldP,
            oldImpact: oldI,
            newProbability: body.probability,
            newImpact: body.impact,
            reason: body.justification ?? `Perubahan penilaian ${body.type.toLowerCase()}`,
            changedById: user.id,
          },
        },
      },
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: "ASSESSMENT_CHANGE", entityType: "RISK", entityId: risk.id,
      before: { [col]: { p: oldP, i: oldI } },
      after: { [col]: { p: body.probability, i: body.impact, score: body.probability * body.impact } },
      description: `Mengubah penilaian ${body.type} untuk ${risk.code}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? null,
    });

    res.json({ message: "Penilaian tersimpan" });
  }),
);

/** POST /api/risks/:id/submit - ajukan risiko (owner) */
risksRouter.post(
  "/:id/submit",
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = submitSchema.safeParse(req.body ?? {});
    const note = parsed.success ? parsed.data.note : undefined;

    const risk = await prisma.risk.findUnique({ where: { id: req.params.id } });
    if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
    requireInScope(user, risk.branchId);
    const isOwner = user.role === "RISK_OWNER" && risk.ownerId === user.id;
    if (!isOwner && user.role !== "MR") throw Forbidden("Hanya Risk Owner pemilik risiko dapat mengajukan");

    if (!["DRAFT", "RETURNED", "REJECTED"].includes(risk.status)) {
      throw Unprocessable(`Risiko dengan status ${risk.status} tidak dapat diajukan`);
    }

    const walsy = await prisma.workflowApproval.create({
      data: {
        riskId: risk.id,
        action: "SUBMIT",
        fromStatus: risk.status,
        toStatus: "SUBMITTED",
        note,
        actorId: user.id,
      },
    });

    await prisma.risk.update({ where: { id: risk.id }, data: { status: "SUBMITTED" } });

    // Notifikasi untuk semua Risk Officer + MR cabang
    const notifyUsers = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null, OR: [{ role: { name: "RISK_OFFICER" }, branchId: risk.branchId }, { role: { name: "MR" } }] },
      select: { id: true },
    });
    if (notifyUsers.length) {
      await prisma.notification.createMany({
        data: notifyUsers.map((u) => ({
          userId: u.id,
          title: "Risiko diajukan",
          message: `${risk.code} - ${risk.title} menunggu review kelengkapan`,
          type: "RISK_SUBMITTED",
          link: `/risks/${risk.id}`,
        })),
      });
    }

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: "SUBMIT", entityType: "RISK", entityId: risk.id,
      before: { status: risk.status }, after: { status: "SUBMITTED" },
      description: `Mengajukan risiko ${risk.code} untuk review`,
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? null,
    });

    void walsy;
    res.json({ message: "Risiko diajukan untuk review" });
  }),
);

/** DELETE /api/risks/:id - hapus draft */
risksRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const user = req.user!;
    const risk = await prisma.risk.findUnique({ where: { id: req.params.id } });
    if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
    requireInScope(user, risk.branchId);

    const isOwner = user.role === "RISK_OWNER" && risk.ownerId === user.id;
    if (!isOwner && user.role !== "MR") throw Forbidden("Tidak memiliki izin menghapus");

    if (risk.status !== "DRAFT") {
      throw Unprocessable("Hanya risiko berstatus Draft yang dapat dihapus");
    }

    await prisma.risk.update({ where: { id: risk.id }, data: { deletedAt: new Date() } });
    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: "DELETE", entityType: "RISK", entityId: risk.id,
      before: { code: risk.code, title: risk.title },
      description: `Menghapus risiko ${risk.code}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? null,
    });
    res.json({ message: "Risiko dihapus" });
  }),
);
