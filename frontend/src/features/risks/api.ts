import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RiskLevel, RiskStatus } from "./types";

export interface RiskListItem {
  id: string;
  code: string;
  title: string;
  status: RiskStatus;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualScore: number | null;
  residualLevel: RiskLevel | null;
  residualProbability: number | null;
  residualImpact: number | null;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; code: string; name: string };
  category: { id: string; name: string };
  owner: { id: string; fullName: string };
}

export interface RiskListResponse {
  data: RiskListItem[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface ReferenceOption {
  id: string;
  code?: string;
  name: string;
  isActive?: boolean;
}

export interface OwnerOption {
  id: string;
  fullName: string;
  branchId: string | null;
}

export const riskKeys = {
  list: (params: Record<string, unknown>) => ["risks", "list", params] as const,
  detail: (id: string) => ["risks", "detail", id] as const,
  refs: ["risks", "refs"] as const,
  matrix: (params: Record<string, unknown>) => ["matrix", params] as const,
};

export async function fetchRisks(params: Record<string, unknown>) {
  const res = await api.get("/risks", { params });
  return res.data as RiskListResponse;
}

export async function fetchDetail(id: string) {
  const res = await api.get(`/risks/${id}`);
  return res.data as { risk: RiskDetail };
}

export async function fetchMatrix(params: Record<string, unknown>) {
  const res = await api.get("/matrix", { params });
  return res.data as MatrixData;
}

export async function fetchRefs() {
  const [branches, categories] = await Promise.all([
    api.get("/branches", { params: { active: true } }).then((r) => r.data as { data: ReferenceOption[] }).catch(() => ({ data: [] as ReferenceOption[] })),
    api.get("/categories").then((r) => r.data as { data: ReferenceOption[] }).catch(() => ({ data: [] as ReferenceOption[] })),
  ]);
  return { branches: branches?.data ?? [], categories: categories?.data ?? [] };
}

export async function fetchOwners(branchId: string) {
  const res = await api.get("/owners", { params: { branchId } });
  return (res.data as { data: OwnerOption[] }).data ?? [];
}

export interface AssessmentSnapshot {
  id: string;
  type: "INHERENT" | "RESIDUAL";
  probability: number;
  impact: number;
  score: number;
  level: RiskLevel;
  justification: string | null;
  assessedBy: { fullName: string } | null;
  createdAt: string;
}

export interface RiskDetail {
  id: string;
  code: string;
  title: string;
  description: string;
  causes: string | null;
  impacts: string | null;
  status: RiskStatus;
  inherentProbability: number;
  inherentImpact: number;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualProbability: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  residualLevel: RiskLevel | null;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; code: string; name: string };
  category: { id: string; name: string };
  owner: { id: string; fullName: string };
  createdBy?: { fullName: string };
  assessments: AssessmentSnapshot[];
  histories: HistoryRow[];
  approvals: ApprovalRow[];
  comments: CommentRow[];
  mitigations: MitigationSummary[];
}

export interface HistoryRow {
  id: string;
  type: "INHERENT" | "RESIDUAL";
  oldProbability: number | null;
  oldImpact: number | null;
  newProbability: number;
  newImpact: number;
  reason: string | null;
  changedBy: { fullName: string } | null;
  createdAt: string;
}

export interface ApprovalRow {
  id: string;
  action: string;
  fromStatus: RiskStatus | null;
  toStatus: RiskStatus | null;
  note: string | null;
  actor: { fullName: string } | null;
  createdAt: string;
}

export interface CommentRow {
  id: string;
  authorRole: string;
  comment: string;
  isResolved: boolean;
  author: { fullName: string } | null;
  createdAt: string;
}

export interface MitigationSummary {
  id: string;
  description: string;
  progress: number;
  status: string;
  dueDate: string | null;
  responsible: { fullName: string } | null;
}

export interface MatrixData {
  type: "inherent" | "residual";
  cells: { prob: number; impact: number; count: number }[];
  levels: { LOW: number; MEDIUM: number; HIGH: number; VERY_HIGH: number };
  total: number;
}

export function useSaveAssessment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { type: "INHERENT" | "RESIDUAL"; probability: number; impact: number; justification?: string }) => {
      await api.post(`/risks/${id}/assessment`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riskKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["matrix"] });
    },
  });
}

export function useSubmitRisk(id: string, opts?: { onSuccess?: () => void; onError?: (msg: string) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note?: string) => {
      await api.post(`/risks/${id}/submit`, { note: note ?? undefined });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riskKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ["risks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      opts?.onSuccess?.();
    },
    onError: (err) => opts?.onError?.(getErr(err)),
  });
}

export function useDeleteRisk(opts?: { onSuccess?: () => void; onError?: (msg: string) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/risks/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["risks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      opts?.onSuccess?.();
    },
    onError: (err) => opts?.onError?.(getErr(err)),
  });
}

export function useCreateRisk(opts?: { onSuccess?: () => void; onError?: (msg: string) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown) => {
      const res = await api.post("/risks", body);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["risks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      opts?.onSuccess?.();
    },
    onError: (err) => opts?.onError?.(getErr(err)),
  });
}

export function useUpdateRisk(id: string, opts?: { onSuccess?: () => void; onError?: (msg: string) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown) => {
      await api.put(`/risks/${id}`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riskKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ["risks"] });
      opts?.onSuccess?.();
    },
    onError: (err) => opts?.onError?.(getErr(err)),
  });
}

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Terjadi kesalahan";
}
