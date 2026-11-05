import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";

export const refsRouter = Router();
refsRouter.use(authenticate);

/** GET /api/branches?active=true — daftar branch utk filter/option */
refsRouter.get("/branches", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const onlyActive = req.query.active === "true";
    const data = await prisma.branch.findMany({
      where: {
        ...(user.role !== "MR" ? { id: user.branchId ?? "" } : {}),
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, isActive: true },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** GET /api/categories — daftar kategori risiko */
refsRouter.get("/categories", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.riskCategory.findMany({
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true, isActive: true },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** GET /api/owners?branchId= — daftar Risk Owner aktif (untuk penugasan risiko) */
refsRouter.get("/owners", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const branchId = (req.query.branchId as string | undefined) || (user.role !== "MR" ? user.branchId ?? "" : undefined);
    const data = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: "RISK_OWNER" },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, branchId: true },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
