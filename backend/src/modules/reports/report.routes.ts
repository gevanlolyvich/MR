import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(authenticate);

interface ReportFilters {
  branchId?: string;
  categoryId?: string;
  level?: string;
  status?: string;
  from?: string;
  to?: string;
}

function buildWhere(req: Request): { where: Record<string, unknown>; filters: ReportFilters } {
  const user = req.user!;
  const filters: ReportFilters = {
    branchId: req.query.branchId as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    level: req.query.level as string | undefined,
    status: req.query.status as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  };

  if (user.role !== "MR") filters.branchId = user.branchId ?? "__none__";

  const createdAt =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
        }
      : undefined;

  const where = {
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.level ? { residualLevel: filters.level as never } : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(createdAt ? { createdAt } : {}),
  };

  return { where, filters };
}

async function buildReport(req: Request) {
  const { where, filters } = buildWhere(req);

  const risks = await prisma.risk.findMany({
    where,
    orderBy: [{ residualScore: "desc" }, { inherentScore: "desc" }],
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      inherentScore: true,
      inherentLevel: true,
      residualScore: true,
      residualLevel: true,
      createdAt: true,
      updatedAt: true,
      branch: { select: { code: true, name: true } },
      category: { select: { name: true } },
      owner: { select: { fullName: true } },
      mitigations: {
        where: { deletedAt: null },
        select: { progress: true, status: true, budget: true, dueDate: true },
      },
    },
  });

  const totalBudget = risks.reduce(
    (sum, r) => sum + r.mitigations.reduce((s, m) => s + Number(m.budget ?? 0), 0),
    0,
  );
  const allMitigations = risks.flatMap((r) => r.mitigations);
  const completedMitigations = allMitigations.filter((m) => m.status === "COMPLETED").length;
  const avgProgress =
    allMitigations.length > 0
      ? Math.round(allMitigations.reduce((s, m) => s + m.progress, 0) / allMitigations.length)
      : 0;
  const overdueMitigations = allMitigations.filter(
    (m) => m.status !== "COMPLETED" && m.dueDate && m.dueDate.getTime() < Date.now(),
  ).length;

  const byLevel = (["VERY_HIGH", "HIGH", "MEDIUM", "LOW"] as const).map((level) => ({
    level,
    total: risks.filter((r) => (r.residualLevel ?? r.inherentLevel) === level).length,
  }));

  const byStatus = Object.entries(
    risks.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([status, total]) => ({ status, total }));

  const categoryMap = new Map<string, number>();
  const branchMap = new Map<string, { code: string; name: string; total: number }>();
  for (const r of risks) {
    categoryMap.set(r.category.name, (categoryMap.get(r.category.name) ?? 0) + 1);
    const b = branchMap.get(r.branch.code) ?? { code: r.branch.code, name: r.branch.name, total: 0 };
    b.total += 1;
    branchMap.set(r.branch.code, b);
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
  const byBranch = Array.from(branchMap.values()).sort((a, b) => b.total - a.total);

  return {
    filters,
    summary: {
      total: risks.length,
      active: risks.filter((r) => r.status === "ACTIVE").length,
      closed: risks.filter((r) => r.status === "CLOSED").length,
      highInherent: risks.filter((r) => r.inherentLevel === "HIGH" || r.inherentLevel === "VERY_HIGH").length,
      highResidual: risks.filter((r) => r.residualLevel === "HIGH" || r.residualLevel === "VERY_HIGH").length,
      totalMitigations: allMitigations.length,
      completedMitigations,
      overdueMitigations,
      avgProgress,
      totalBudget,
    },
    byLevel,
    byStatus,
    byCategory,
    byBranch,
    rows: risks.map((r) => {
      const plans = r.mitigations;
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        status: r.status,
        branch: r.branch,
        category: r.category.name,
        owner: r.owner.fullName,
        inherentScore: r.inherentScore,
        inherentLevel: r.inherentLevel,
        residualScore: r.residualScore,
        residualLevel: r.residualLevel,
        mitigationCount: plans.length,
        mitigationProgress:
          plans.length > 0 ? Math.round(plans.reduce((s, m) => s + m.progress, 0) / plans.length) : 0,
        updatedAt: r.updatedAt,
      };
    }),
  };
}

/** GET /api/reports */
reportsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await buildReport(req));
  } catch (err) {
    next(err);
  }
});

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** GET /api/reports/export.csv */
reportsRouter.get("/export.csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await buildReport(req);
    const header = [
      "Kode",
      "Judul Risiko",
      "Branch",
      "Kategori",
      "Risk Owner",
      "Status",
      "Skor Inherent",
      "Level Inherent",
      "Skor Residual",
      "Level Residual",
      "Jumlah Mitigasi",
      "Progres Mitigasi (%)",
      "Diperbarui",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const row of report.rows) {
      lines.push(
        [
          row.code,
          row.title,
          `${row.branch.code} - ${row.branch.name}`,
          row.category,
          row.owner,
          row.status,
          row.inherentScore,
          row.inherentLevel,
          row.residualScore ?? "",
          row.residualLevel ?? "",
          row.mitigationCount,
          row.mitigationProgress,
          new Date(row.updatedAt).toISOString().slice(0, 10),
        ]
          .map(csvCell)
          .join(","),
      );
    }

    const filename = `risk-register-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (err) {
    next(err);
  }
});
