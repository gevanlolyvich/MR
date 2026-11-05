import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RiskLevel, RiskStatus } from "@/features/risks/types";

export interface ReportSummary {
  total: number;
  active: number;
  closed: number;
  highInherent: number;
  highResidual: number;
  totalMitigations: number;
  completedMitigations: number;
  overdueMitigations: number;
  avgProgress: number;
  totalBudget: number;
}

export interface ReportRow {
  id: string;
  code: string;
  title: string;
  status: RiskStatus;
  branch: { code: string; name: string };
  category: string;
  owner: string;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualScore: number | null;
  residualLevel: RiskLevel | null;
  mitigationCount: number;
  mitigationProgress: number;
  updatedAt: string;
}

export interface ReportData {
  summary: ReportSummary;
  byLevel: { level: RiskLevel; total: number }[];
  byStatus: { status: RiskStatus; total: number }[];
  byCategory: { name: string; total: number }[];
  byBranch: { code: string; name: string; total: number }[];
  rows: ReportRow[];
}

export const reportKeys = {
  data: (params: Record<string, unknown>) => ["reports", "data", params] as const,
};

export async function fetchReport(params: Record<string, unknown>) {
  const res = await api.get("/reports", { params });
  return res.data as ReportData;
}

export function useReport(params: Record<string, unknown>) {
  return useQuery({
    queryKey: reportKeys.data(params),
    queryFn: () => fetchReport(params),
    placeholderData: (prev) => prev,
  });
}

export function reportExportUrl(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return `/api/reports/export.csv${qs ? `?${qs}` : ""}`;
}
