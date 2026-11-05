export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export type RiskStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "RETURNED"
  | "PENDING_VALIDATION"
  | "REJECTED"
  | "ACTIVE"
  | "PENDING_VERIFICATION"
  | "CLOSED";

/** Warna sel matrix berdasarkan skor */
export function cellColor(score: number) {
  if (score >= 16) return "#B3242B"; // very high
  if (score >= 11) return "#E94343"; // high
  if (score >= 6) return "#F5B820"; // medium (kuning brand)
  return "#159B69"; // low
}

export function cellText(score: number) {
  return score >= 16 ? "#FFFFFF" : score >= 11 ? "#FFFFFF" : "#17324D";
}
