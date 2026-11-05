import { Router, NextFunction, Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { BadRequest, Forbidden, NotFound, Unprocessable, errorFromZod } from "../../lib/error";
import { getIpAddress, logAudit } from "../../lib/audit";
import { RoleName } from "@prisma/client";

export const mitigationsRouter = Router();
mitigationsRouter.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    void fn(req, res, next).catch(next);

function requireInScope(user: { role: RoleName; branchId: string | null }, branchId: string) {
  if (user.role !== "MR" && user.branchId !== branchId) {
    throw Forbidden("Data ini di luar cakupan cabang Anda");
  }
}

function canManage(user: { id: string; role: RoleName; branchId: string | null }, risk: { ownerId: string; branchId: string }) {
  if (user.role === "MR") return true;
  if (user.role === "RISK_OFFICER" && user.branchId === risk.branchId) return true;
  return risk.ownerId === user.id;
}

async function notify(users: { id: string }[], payload: { title: string; message: string; type: string; link?: string }) {
  if (!users.length) return;
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, ...payload })) });
}

const createSchema = z.object({
  riskId: z.string().min(1),
  description: z.string().min(5, "Uraian minimal 5 karakter").max(2000),
  actionPlan: z.string().max(2000).optional(),
  responsibleId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  budget: z.coerce.number().min(0).optional(),
});

const updateSchema = z.object({
  description: z.string().min(5).max(2000).optional(),
  actionPlan: z.string().max(2000).optional(),
  responsibleId: z.string().optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  budget: z.coerce.number().min(0).nullable().optional(),
});

const progressSchema = z.object({
  progress: z.coerce.number().int().min(0).max(100),
  note: z.string().max(1000).optional(),
});

const verifySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(1000).optional(),
});

const uploadDir = path.join(process.cwd(), "uploads", "evidence");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Tipe file tidak didukung (PDF, gambar, Word, Excel)"));
      return;
    }
    cb(null, true);
  },
});

async function findPlan(id: string) {
  const plan = await prisma.mitigationPlan.findUnique({
    where: { id },
    include: { risk: true },
  });
  if (!plan || plan.deletedAt) throw NotFound("Rencana mitigasi tidak ditemukan");
  return plan;
}

/** GET /api/mitigations - daftar rencana mitigasi sesuai scope */
mitigationsRouter.get(
  "/",
  requirePermission("mitigation:manage", "mitigation:verify"),
  wrap(async (req, res) => {
    const user = req.user!;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize ?? 10)));
    const q = (req.query.q as string | undefined)?.trim();
    const status = (req.query.status as string | undefined) || undefined;
    const riskId = (req.query.riskId as string | undefined) || undefined;
    const branchId = (req.query.branchId as string | undefined) || undefined;

    const where = {
      deletedAt: null,
      ...(riskId ? { riskId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(q ? { OR: [{ description: { contains: q } }, { risk: { code: { contains: q } } }, { risk: { title: { contains: q } } }] } : {}),
      risk: {
        deletedAt: null,
        ...(user.role !== "MR" ? { branchId: user.branchId ?? "" } : branchId ? { branchId } : {}),
      },
    };

    const [rows, total] = await Promise.all([
      prisma.mitigationPlan.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          risk: { select: { id: true, code: true, title: true, status: true, ownerId: true, branch: { select: { id: true, code: true, name: true } } } },
          responsible: { select: { id: true, fullName: true } },
          _count: { select: { updates: true, evidences: true } },
        },
      }),
      prisma.mitigationPlan.count({ where }),
    ]);

    res.json({ data: rows, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  }),
);

/** POST /api/mitigations - buat rencana mitigasi untuk risiko ACTIVE */
mitigationsRouter.post(
  "/",
  requirePermission("mitigation:manage"),
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const body = parsed.data;

    const risk = await prisma.risk.findUnique({ where: { id: body.riskId } });
    if (!risk || risk.deletedAt) throw NotFound("Risiko tidak ditemukan");
    if (!canManage(user, risk)) throw Forbidden("Tidak dapat menambah mitigasi untuk risiko ini");
    if (risk.status !== "ACTIVE") throw Unprocessable("Mitigasi hanya dapat dibuat untuk risiko berstatus Aktif");

    const responsibleId = body.responsibleId ?? risk.ownerId;
    const responsible = await prisma.user.findFirst({
      where: { id: responsibleId, isActive: true, deletedAt: null, branchId: risk.branchId, role: { name: "RISK_OWNER" } },
    });
    if (!responsible) throw BadRequest("Penanggung jawab harus Risk Owner aktif pada branch yang sama");

    if (body.startDate && body.dueDate && body.dueDate < body.startDate) {
      throw BadRequest("Tanggal target tidak boleh sebelum tanggal mulai");
    }

    const plan = await prisma.mitigationPlan.create({
      data: {
        riskId: risk.id,
        description: body.description,
        actionPlan: body.actionPlan,
        responsibleId,
        startDate: body.startDate,
        dueDate: body.dueDate,
        budget: body.budget,
        status: "NOT_STARTED",
      },
    });

    await notify([{ id: responsibleId }], {
      title: "Rencana mitigasi baru",
      message: `${risk.code}: ${body.description.slice(0, 120)}`,
      type: "MITIGATION_ASSIGNED",
      link: `/mitigations`,
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: risk.branchId,
      action: "CREATE", entityType: "MITIGATION", entityId: plan.id,
      after: { riskCode: risk.code, description: body.description },
      description: `Menambah rencana mitigasi untuk ${risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.status(201).json({ plan });
  }),
);

/** PUT /api/mitigations/:id - ubah rencana mitigasi */
mitigationsRouter.put(
  "/:id",
  requirePermission("mitigation:manage"),
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const body = parsed.data;

    const plan = await findPlan(req.params.id);
    if (!canManage(user, plan.risk)) throw Forbidden("Tidak dapat mengubah mitigasi ini");
    if (plan.status === "COMPLETED") throw Unprocessable("Mitigasi yang sudah selesai tidak dapat diubah");

    if (body.responsibleId) {
      const responsible = await prisma.user.findFirst({
        where: { id: body.responsibleId, isActive: true, deletedAt: null, branchId: plan.risk.branchId, role: { name: "RISK_OWNER" } },
      });
      if (!responsible) throw BadRequest("Penanggung jawab harus Risk Owner aktif pada branch yang sama");
    }

    const updated = await prisma.mitigationPlan.update({
      where: { id: plan.id },
      data: {
        description: body.description,
        actionPlan: body.actionPlan,
        responsibleId: body.responsibleId,
        startDate: body.startDate,
        dueDate: body.dueDate,
        budget: body.budget,
      },
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: plan.risk.branchId,
      action: "UPDATE", entityType: "MITIGATION", entityId: plan.id,
      description: `Mengubah rencana mitigasi ${plan.risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ plan: updated });
  }),
);

/** POST /api/mitigations/:id/progress - update progres (owner/PIC) */
mitigationsRouter.post(
  "/:id/progress",
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const { progress, note } = parsed.data;

    const plan = await findPlan(req.params.id);
    const isPic = plan.responsibleId === user.id;
    if (!isPic && !canManage(user, plan.risk)) throw Forbidden("Hanya PIC atau pengelola risiko yang dapat memperbarui progres");
    if (plan.status === "COMPLETED") throw Unprocessable("Mitigasi sudah selesai");

    const status = progress >= 100 ? "PENDING_VERIFICATION" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED";

    await prisma.$transaction([
      prisma.mitigationPlan.update({ where: { id: plan.id }, data: { progress, status } }),
      prisma.mitigationUpdate.create({
        data: { planId: plan.id, progress, note, submittedById: user.id },
      }),
    ]);

    if (status === "PENDING_VERIFICATION") {
      const reviewers = await prisma.user.findMany({
        where: {
          isActive: true, deletedAt: null,
          OR: [{ role: { name: "RISK_OFFICER" }, branchId: plan.risk.branchId }, { role: { name: "MR" } }],
        },
        select: { id: true },
      });
      await notify(reviewers, {
        title: "Mitigasi menunggu verifikasi",
        message: `${plan.risk.code}: ${plan.description.slice(0, 120)} mencapai 100%`,
        type: "MITIGATION_PENDING_VERIFICATION",
        link: `/mitigations`,
      });
    }

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: plan.risk.branchId,
      action: "UPDATE_PROGRESS", entityType: "MITIGATION", entityId: plan.id,
      before: { progress: plan.progress }, after: { progress },
      description: `Update progres mitigasi ${plan.risk.code} menjadi ${progress}%`,
      ipAddress: getIpAddress(req),
    });

    res.json({ message: "Progres mitigasi tersimpan", status });
  }),
);

/** POST /api/mitigations/:id/verify - verifikasi penyelesaian mitigasi (officer/MR) */
mitigationsRouter.post(
  "/:id/verify",
  requirePermission("mitigation:verify"),
  wrap(async (req, res) => {
    const user = req.user!;
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) throw errorFromZod(parsed.error);
    const { decision, note } = parsed.data;

    const plan = await findPlan(req.params.id);
    requireInScope(user, plan.risk.branchId);
    if (plan.status !== "PENDING_VERIFICATION") throw Unprocessable("Mitigasi belum diajukan untuk verifikasi");

    const approve = decision === "APPROVE";
    const updated = await prisma.mitigationPlan.update({
      where: { id: plan.id },
      data: approve
        ? { status: "COMPLETED", progress: 100, verifiedById: user.id, verifiedAt: new Date() }
        : { status: "IN_PROGRESS" },
    });

    await prisma.workflowApproval.create({
      data: {
        riskId: plan.riskId,
        planId: plan.id,
        action: approve ? "VERIFY" : "VERIFY_REJECT",
        note,
        actorId: user.id,
      },
    });

    await notify([{ id: plan.responsibleId }], {
      title: approve ? "Mitigasi diverifikasi" : "Mitigasi perlu perbaikan",
      message: `${plan.risk.code}: ${plan.description.slice(0, 120)}${note ? ` · ${note}` : ""}`,
      type: approve ? "MITIGATION_COMPLETED" : "MITIGATION_REJECTED",
      link: `/mitigations`,
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: plan.risk.branchId,
      action: approve ? "VERIFY" : "VERIFY_REJECT", entityType: "MITIGATION", entityId: plan.id,
      description: `${approve ? "Memverifikasi" : "Menolak"} mitigasi ${plan.risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.json({ plan: updated });
  }),
);

/** POST /api/mitigations/:id/evidence - unggah bukti pelaksanaan */
mitigationsRouter.post(
  "/:id/evidence",
  requirePermission("mitigation:manage", "mitigation:verify"),
  upload.single("file"),
  wrap(async (req, res) => {
    const user = req.user!;
    const plan = await findPlan(req.params.id);
    if (!canManage(user, plan.risk) && user.role !== "RISK_OFFICER") {
      throw Forbidden("Tidak dapat mengunggah bukti untuk mitigasi ini");
    }
    if (!req.file) throw BadRequest("File bukti wajib diunggah");

    const evidence = await prisma.mitigationEvidence.create({
      data: {
        planId: plan.id,
        fileName: req.file.originalname,
        filePath: `/uploads/evidence/${req.file.filename}`,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedById: user.id,
      },
    });

    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: plan.risk.branchId,
      action: "UPLOAD", entityType: "MITIGATION_EVIDENCE", entityId: evidence.id,
      description: `Mengunggah bukti mitigasi ${plan.risk.code}`,
      ipAddress: getIpAddress(req),
    });

    res.status(201).json({ evidence });
  }),
);

/** DELETE /api/mitigations/:id - hapus rencana (belum berjalan) */
mitigationsRouter.delete(
  "/:id",
  requirePermission("mitigation:manage"),
  wrap(async (req, res) => {
    const user = req.user!;
    const plan = await findPlan(req.params.id);
    if (!canManage(user, plan.risk)) throw Forbidden("Tidak dapat menghapus mitigasi ini");
    if (plan.status !== "NOT_STARTED") throw Unprocessable("Hanya mitigasi yang belum berjalan dapat dihapus");

    await prisma.mitigationPlan.update({ where: { id: plan.id }, data: { deletedAt: new Date() } });
    await logAudit({
      actorId: user.id, actorName: user.username, actorRole: user.role, branchId: plan.risk.branchId,
      action: "DELETE", entityType: "MITIGATION", entityId: plan.id,
      description: `Menghapus rencana mitigasi ${plan.risk.code}`,
      ipAddress: getIpAddress(req),
    });
    res.json({ message: "Rencana mitigasi dihapus" });
  }),
);
