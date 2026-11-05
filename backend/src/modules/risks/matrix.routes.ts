import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate, requirePermission } from "../../middleware/auth";

export const matrixRouter = Router();
matrixRouter.use(authenticate);

function grid(cellCounts: { p: number; i: number; count: number }[]) {
  const cells: { prob: number; impact: number; count: number }[] = [];
  for (let p = 5; p >= 1; p--) {
    for (let i = 1; i <= 5; i++) {
      const found = cellCounts.find((c) => c.p === p && c.i === i);
      cells.push({ prob: p, impact: i, count: found?.count ?? 0 });
    }
  }
  return cells;
}

/** GET /api/matrix?branchId&categoryId&type=inherent|residual */
matrixRouter.get(
  "/",
  requirePermission("matrix:view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const branchId = (req.query.branchId as string | undefined) || (user.role !== "MR" ? user.branchId ?? "" : undefined);
      const categoryId = (req.query.categoryId as string | undefined) || undefined;
      const type = req.query.type === "residual" ? "residual" : "inherent";

      const risks = await prisma.risk.findMany({
        where: {
          deletedAt: null,
          ...(branchId ? { branchId } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(type === "residual" ? { residualScore: { not: null } } : {}),
        },
        select: {
          inherentProbability: true, inherentImpact: true,
          residualProbability: true, residualImpact: true,
        },
      });

      const counts = new Map<string, number>();
      for (const r of risks) {
        const p = type === "inherent" ? r.inherentProbability : r.residualProbability;
        const i = type === "inherent" ? r.inherentImpact : r.residualImpact;
        if (p == null || i == null) continue;
        const key = `${p}-${i}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const cellCounts = Array.from(counts.entries()).map(([k, count]) => {
        const [p, i] = k.split("-").map(Number);
        return { p, i, count };
      });

      // jumlah risiko per level utk legend
      const levels = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 } as Record<string, number>;
      for (const r of risks) {
        const p = type === "inherent" ? r.inherentProbability : r.residualProbability;
        const i = type === "inherent" ? r.inherentImpact : r.residualImpact;
        if (p == null || i == null) continue;
        const s = p * i;
        if (s >= 16) levels.VERY_HIGH++;
        else if (s >= 11) levels.HIGH++;
        else if (s >= 6) levels.MEDIUM++;
        else levels.LOW++;
      }

      res.json({
        type,
        cells: grid(cellCounts),
        levels,
        total: risks.length,
      });
    } catch (err) {
      next(err);
    }
  },
);
