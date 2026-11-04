import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/error";
import { Prisma } from "@prisma/client";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Data dengan nilai tersebut sudah ada", code: "CONFLICT" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Data tidak ditemukan", code: "NOT_FOUND" });
    }
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ message: "Terjadi kesalahan di server", code: "INTERNAL_ERROR" });
}
