import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MitigationRow {
  id: string;
  riskId: string;
  description: string;
  actionPlan: string | null;
  responsibleId: string;
  startDate: string | null;
  dueDate: string | null;
  budget: string | number | null;
  progress: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PENDING_VERIFICATION";
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  risk: { id: string; code: string; title: string; status: string; ownerId: string; branch: { id: string; code: string; name: string } };
  responsible: { id: string; fullName: string };
  _count: { updates: number; evidences: number };
}

export interface MitigationListResponse {
  data: MitigationRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface MitigationBody {
  riskId?: string;
  description?: string;
  actionPlan?: string;
  responsibleId?: string;
  startDate?: string | null;
  dueDate?: string | null;
  budget?: number | null;
}

export const mitigationKeys = {
  list: (params: Record<string, unknown>) => ["mitigations", "list", params] as const,
};

export async function fetchMitigations(params: Record<string, unknown>) {
  const res = await api.get("/mitigations", { params });
  return res.data as MitigationListResponse;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["mitigations"] });
    void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
}

export function useCreateMitigation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: MitigationBody) => {
      const res = await api.post("/mitigations", body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateMitigation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: MitigationBody }) => {
      await api.put(`/mitigations/${id}`, body);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateProgress() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, progress, note }: { id: string; progress: number; note?: string }) => {
      await api.post(`/mitigations/${id}/progress`, { progress, note: note || undefined });
    },
    onSuccess: invalidate,
  });
}

export function useVerifyMitigationPlan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "APPROVE" | "REJECT"; note?: string }) => {
      await api.post(`/mitigations/${id}/verify`, { decision, note: note || undefined });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteMitigation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/mitigations/${id}`);
    },
    onSuccess: invalidate,
  });
}

export async function uploadMitigationEvidence(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post(`/mitigations/${id}/evidence`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export const MITIGATION_STATUS: Record<
  MitigationRow["status"],
  { label: string; variant: "default" | "primary" | "warning" | "success" }
> = {
  NOT_STARTED: { label: "Belum Dimulai", variant: "default" },
  IN_PROGRESS: { label: "Berjalan", variant: "primary" },
  COMPLETED: { label: "Selesai", variant: "success" },
  PENDING_VERIFICATION: { label: "Menunggu Verifikasi", variant: "warning" },
};
