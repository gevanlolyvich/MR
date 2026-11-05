import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";

dotenv.config();

import { authRouter } from "./modules/auth/auth.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { risksRouter } from "./modules/risks/risk.routes";
import { matrixRouter } from "./modules/risks/matrix.routes";
import { refsRouter } from "./modules/master/refs.routes";
import { approvalsRouter } from "./modules/approvals/approval.routes";
import { mitigationsRouter } from "./modules/mitigations/mitigation.routes";
import { monitoringRouter } from "./modules/monitoring/monitoring.routes";
import { notificationsRouter } from "./modules/notifications/notification.routes";
import { usersRouter } from "./modules/users/user.routes";
import { branchesRouter } from "./modules/master/branch.routes";
import { categoriesRouter } from "./modules/master/category.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { settingsRouter } from "./modules/settings/setting.routes";
import { reportsRouter } from "./modules/reports/report.routes";
import { notFoundHandler, errorHandler } from "./middleware/error";

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// File bukti mitigasi / lampiran
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), { fallthrough: false }));

// Rate limit global ringan
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak permintaan, coba lagi nanti." },
});
app.use("/api", globalLimiter);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "jxb-mr" }));

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/risks", risksRouter);
app.use("/api/matrix", matrixRouter);
app.use("/api/approvals", approvalsRouter);
app.use("/api/mitigations", mitigationsRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/master/branches", branchesRouter);
app.use("/api/master/categories", categoriesRouter);
app.use("/api/audit", auditRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api", refsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
