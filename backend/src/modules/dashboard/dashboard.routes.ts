import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";
import { AuditLog, RiskLevel, RiskStatus } from "@prisma/client";

export const dashboardRouter = Router();

const levelOrder: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];
const levelColor: Record<RiskLevel, string> = {
  LOW: "#159B69",
  MEDIUM: "#E6A817",
  HIGH: "#E94343",
  VERY_HIGH: "#B3242B",
};
const levelLabels: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VERY_HIGH: "Very High",
};
const statusLabels: Record<RiskStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Diajukan",
  RETURNED: "Direvisi",
  PENDING_VALIDATION: "Menunggu Validasi",
  REJECTED: "Ditolak",
  ACTIVE: "Aktif",
  PENDING_VERIFICATION: "Menunggu Verifikasi",
  CLOSED: "Ditutup",
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function scopeOf(user: { role: string; branchId: string | null }) {
  return user.role === "MR" ? {} : { branchId: user.branchId ?? "" };
}

dashboardRouter.get(
  "/",
  authenticate,
  requirePermission("dashboard:view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const role = user.role;
      const scope = scopeOf(user);
      const now = new Date();
      const trendFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [totalRisks, levelRows, statusRows, categoryRows, branchRows, highActiveByBranch] =
        await Promise.all([
          prisma.risk.count({ where: { ...scope, deletedAt: null } }),
          prisma.risk.groupBy({ by: ["inherentLevel"], where: { ...scope, deletedAt: null }, _count: { _all: true } }),
          prisma.risk.groupBy({ by: ["status"], where: { ...scope, deletedAt: null }, _count: { _all: true } }),
          prisma.risk.groupBy({ by: ["categoryId"], where: { ...scope, deletedAt: null }, _count: { _all: true } }),
          role === "MR"
            ? prisma.risk.groupBy({ by: ["branchId"], where: { deletedAt: null }, _count: { _all: true } })
            : Promise.resolve<{ branchId: string; _count: { _all: number } }[]>([]),
          prisma.risk.groupBy({
            by: ["branchId"],
            where: { deletedAt: null, inherentLevel: { in: ["HIGH", "VERY_HIGH"] }, status: { notIn: ["CLOSED", "REJECTED"] } },
            _count: { _all: true },
          }),
        ]);

      const [
        mitigationsRunning,
        mitigationsOverdue,
        mitigationsPendingVerification,
        mitigationsCompleted,
        categories,
        trendRisks,
        avgScores,
        activities,
      ] = await Promise.all([
        prisma.mitigationPlan.count({ where: { risk: { ...scope, deletedAt: null }, deletedAt: null, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } }),
        prisma.mitigationPlan.count({ where: { risk: { ...scope, deletedAt: null }, deletedAt: null, status: { in: ["NOT_STARTED", "IN_PROGRESS"] }, dueDate: { lt: now } } }),
        prisma.mitigationPlan.count({ where: { risk: { ...scope, deletedAt: null }, deletedAt: null, status: "PENDING_VERIFICATION" } }),
        prisma.mitigationPlan.count({ where: { risk: { ...scope, deletedAt: null }, deletedAt: null, status: "COMPLETED" } }),
        prisma.riskCategory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.risk.findMany({
          where: { ...scope, deletedAt: null, createdAt: { gte: trendFrom } },
          select: { createdAt: true, residualLevel: true },
        }),
        prisma.risk.aggregate({
          where: { ...scope, deletedAt: null, residualScore: { not: null } },
          _avg: { inherentScore: true, residualScore: true },
        }),
        prisma.auditLog.findMany({
          where: user.role === "MR" ? {} : { branchId: user.branchId ?? "" },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, action: true, description: true, actorName: true, createdAt: true },
        }),
      ]);

      // Tugas berdasarkan role
      const [toReview, toValidate, toVerify, returnedCount, rejectedCount] = await Promise.all([
        role === "RISK_OFFICER"
          ? prisma.risk.count({ where: { ...scope, deletedAt: null, status: "SUBMITTED" } })
          : Promise.resolve(0),
        role === "MR" ? prisma.risk.count({ where: { deletedAt: null, status: "PENDING_VALIDATION" } }) : Promise.resolve(0),
        role === "MR" || role === "RISK_OFFICER"
          ? prisma.risk.count({ where: { ...scope, deletedAt: null, status: "PENDING_VERIFICATION" } })
          : Promise.resolve(0),
        role === "RISK_OFFICER" || role === "RISK_OWNER"
          ? prisma.risk.count({ where: { ...scope, deletedAt: null, status: "RETURNED" } })
          : Promise.resolve(0),
        role === "RISK_OWNER" ? prisma.risk.count({ where: { ...scope, deletedAt: null, status: "REJECTED" } }) : Promise.resolve(0),
      ]);

      const branches = await prisma.branch.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });

      // Trend 6 bulan
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const key = monthKey(d);
        const inMonth = trendRisks.filter((t) => monthKey(t.createdAt) === key);
        return {
          month: d.toLocaleString("id-ID", { month: "short" }),
          baru: inMonth.length,
          withResidual: inMonth.filter((t) => t.residualLevel != null).length,
        };
      });

      const byLevel = levelOrder.map((l) => ({
        level: levelLabels[l],
        color: levelColor[l],
        total: levelRows.find((r) => r.inherentLevel === l)?._count._all ?? 0,
      }));
      const byStatus = (Object.keys(statusLabels) as RiskStatus[]).map((s) => ({
        status: s,
        label: statusLabels[s],
        total: statusRows.find((r) => r.status === s)?._count._all ?? 0,
      }));
      const catMap = new Map(categories.map((c) => [c.id, c.name]));
      const byCategory = catRows(categoryRows).map((r) => ({
        name: catMap.get(r.categoryId) ?? "Lainnya",
        total: r.total,
      }));
      const byBranch =
        role === "MR"
          ? branches
              .map((b) => ({
                code: b.code,
                name: b.name,
                total: branchRows.find((r) => r.branchId === b.id)?._count?._all ?? 0,
                high: highActiveByBranch.find((r) => r.branchId === b.id)?._count._all ?? 0,
              }))
              .sort((a, b) => b.total - a.total)
          : undefined;

      const payload = {
        scope: role !== "MR" ? { branchId: user.branchId } : null,
        totals: {
          risks: totalRisks,
          highRisk: byLevel.find((l) => l.level === "High")?.total ?? 0,
          veryHighRisk: byLevel.find((l) => l.level === "Very High")?.total ?? 0,
          mitigationsRunning,
          mitigationsOverdue,
          mitigationsPendingVerification,
          mitigationsCompleted,
        },
        byLevel,
        byStatus,
        byCategory,
        byBranch,
        avgScores: {
          inherent: Math.round((avgScores._avg.inherentScore ?? 0) * 10) / 10,
          residual:
            avgScores._avg.residualScore != null ? Math.round(avgScores._avg.residualScore * 10) / 10 : null,
        },
        trend: months,
        tasks: { toReview, toValidate, toVerify, revisionReturned: returnedCount, rejected: rejectedCount },
        recentActivities: activities.map((a: Pick<AuditLog, "id" | "action" | "description" | "actorName" | "createdAt">) => ({
          id: a.id,
          action: a.action,
          description: a.description,
          actor: a.actorName,
          at: a.createdAt,
        })),
      };

      res.json(payload);
    } catch (err) {
      next(err);
    }
  },
);

function catRows(rows: { categoryId: string; _count: { _all: number } }[]) {
  return rows.map((r) => ({ categoryId: r.categoryId, total: r._count._all }));
}
