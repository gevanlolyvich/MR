import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

dotenv.config();

import { authRouter } from "./modules/auth/auth.routes";
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

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
