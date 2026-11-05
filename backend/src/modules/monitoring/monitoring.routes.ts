import { Router, NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";

export const monitoringRouter = Router();
monitoringRouter.use(authenticate);

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    void fn(req, res, next).catch(next);

/** GET /api/monitoring - ringkasan & daftar risiko aktif untuk monitoring */
monitoringRouter.get(
  "/",
  requirePermission("monitoring:view"),
  wrap(async (req, res) => {
    const user = req.user!;
    const branchId = (req.query.branchId as string | undefined) || (user.role !== "MR" ? user.branchId ?? "" : undefined);
    const categoryId = (req.query.categoryId as string | undefined) || undefined;
    const level = (req.query.level as string | undefined) || undefined;
    const q = (req.query.q as string | undefined)?.trim();

    const risks = await prisma.risk.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
        ...(branchId ? { branchId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(level ? { residualLevel: level as never } : {}),
        ...(q ? { OR: [{ code: { contains: q } }, { title: { contains: q } }] } : {}),
      },
      orderBy: [{ residualScore: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true, code: true, title: true, status: true, updatedAt: true,
        inherentScore: true, inherentLevel: true, residualScore: true, residualLevel: true,
        branch: { select: { id: true, code: true, name: true } },
        category: { select: { name: true } },
        owner: { select: { fullName: true } },
        mitigations: {
          where: { deletedAt: null },
          select: { id: true, progress: true, status: true, dueDate: true },
        },
      },
    });

    const now = Date.now();
    const data = risks.map((r) => {
      const plans = r.mitigations;
      const avgProgress = plans.length ? Math.round(plans.reduce((sum, p) => sum + p.progress, 0) / plans.length) : 0;
      const overdue = plans.filter((p) => p.status !== "COMPLETED" && p.dueDate && new Date(p.dueDate).getTime() < now).length;
      const completed = plans.filter((p) => p.status === "COMPLETED").length;
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        status: r.status,
        updatedAt: r.updatedAt,
        inherentScore: r.inherentScore,
        inherentLevel: r.inherentLevel,
        residualScore: r.residualScore,
        residualLevel: r.residualLevel,
        branch: r.branch,
        category: r.category,
        owner: r.owner,
        mitigation: { total: plans.length, completed, avgProgress, overdue },
      };
    });

    const totalActive = data.filter((d) => d.status === "ACTIVE").length;
    const pendingVerification = data.filter((d) => d.status === "PENDING_VERIFICATION").length;
    const overdueRisks = data.filter((d) => d.mitigation.overdue > 0).length;
    const highResidual = data.filter((d) => d.residualLevel === "HIGH" || d.residualLevel === "VERY_HIGH").length;
    const avgProgress = data.length ? Math.round(data.reduce((sum, d) => sum + d.mitigation.avgProgress, 0) / data.length) : 0;

    res.json({
      stats: { total: data.length, totalActive, pendingVerification, overdueRisks, highResidual, avgProgress },
      data,
    });
  }),
);
