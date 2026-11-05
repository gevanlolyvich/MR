import { RiskLevel } from "@prisma/client";
import { z } from "zod";

export function riskScore(probability: number, impact: number) {
  return probability * impact;
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 16) return "VERY_HIGH";
  if (score >= 11) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

/** Object probability+impact (1-5) dengan score & level otomatis. */
export const probImpactSchema = z
  .object({
    probability: z.coerce.number().int().min(1).max(5),
    impact: z.coerce.number().int().min(1).max(5),
    justification: z.string().max(1000).optional(),
  })
  .transform((v) => ({
    ...v,
    score: riskScore(v.probability, v.impact),
    level: riskLevel(riskScore(v.probability, v.impact)),
  }));

/** P1 = sangat jarang ... P5 = hampir pasti (deskripsi skala); I1..I5 utk dampak. */
export const PROBABILITY_LABELS: string[] = [
  "1 - Sangat jarang (per 5 tahun)",
  "2 - Jarang (per 2-3 tahun)",
  "3 - Mungkin (setahun sekali)",
  "4 - Kemungkinan besar (per 6 bulan)",
  "5 - Hampir pasti (per bulan)",
];

export const IMPACT_LABELS: string[] = [
  "1 - Tidak signifikan",
  "2 - Minor",
  "3 - Moderat",
  "4 - Mayor",
  "5 - Katastrofik",
];
