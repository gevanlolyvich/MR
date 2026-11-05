import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RiskLevel, RiskStatus } from "@/features/risks/types";

export interface MonitoringRow {
  id: string;
  code: string;
  title: string;
  status: RiskStatus;
  updatedAt: string;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualScore: number | null;
  residualLevel: RiskLevel | null;
  branch: { id: string; code: string; name: string };
  category: { name: string };
  owner: { fullName: string };
  mitigation: { total: number; completed: number; avgProgress: number; overdue: number };
}

export interface MonitoringResponse {
  stats: {
    total: number;
    totalActive: number;
    pendingVerification: number;
    overdueRisks: number;
    highResidual: number;
    avgProgress: number;
  };
  data: MonitoringRow[];
}

export const monitoringKeys = {
  list: (params: Record<string, unknown>) => ["monitoring", "list", params] as const,
};

export async function fetchMonitoring(params: Record<string, unknown>) {
  const res = await api.get("/monitoring", { params });
  return res.data as MonitoringResponse;
}

export function useMonitoring(params: Record<string, unknown>) {
  return useQuery({
    queryKey: monitoringKeys.list(params),
    queryFn: () => fetchMonitoring(params),
    placeholderData: (prev) => prev,
  });
}
