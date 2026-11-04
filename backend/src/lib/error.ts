import { z } from "zod";

export class AppError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorFromZod(err: z.ZodError): AppError {
  const details = err.flatten().fieldErrors;
  const first =
    Object.values(details).flat()[0] ?? err.errors[0]?.message ?? "Data tidak valid";
  return new AppError(422, first, "VALIDATION_ERROR", details);
}

export const BadRequest = (msg = "Permintaan tidak valid", details?: unknown) =>
  new AppError(400, msg, "BAD_REQUEST", details);
export const Unauthorized = (msg = "Tidak terautentikasi") =>
  new AppError(401, msg, "UNAUTHORIZED");
export const Forbidden = (msg = "Tidak memiliki akses") =>
  new AppError(403, msg, "FORBIDDEN");
export const NotFound = (msg = "Data tidak ditemukan") =>
  new AppError(404, msg, "NOT_FOUND");
export const Conflict = (msg = "Data sudah ada") =>
  new AppError(409, msg, "CONFLICT");
export const Unprocessable = (msg = "Data tidak dapat diproses", details?: unknown) =>
  new AppError(422, msg, "UNPROCESSABLE", details);
