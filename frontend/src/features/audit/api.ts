import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RoleName } from "@/features/users/api";

export interface AuditRow {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: RoleName | null;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
  branch: { code: string; name: string } | null;
}

export interface AuditListResponse {
  data: AuditRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface AuditFilters {
  actions: string[];
  entityTypes: string[];
}

export const auditKeys = {
  list: (params: Record<string, unknown>) => ["audit", "list", params] as const,
  filters: ["audit", "filters"] as const,
};

export async function fetchAudit(params: Record<string, unknown>) {
  const res = await api.get("/audit", { params });
  return res.data as AuditListResponse;
}

export async function fetchAuditFilters() {
  const res = await api.get("/audit/actions");
  return res.data as AuditFilters;
}

export function useAuditFilters() {
  return useQuery({ queryKey: auditKeys.filters, queryFn: fetchAuditFilters, staleTime: 5 * 60_000 });
}
