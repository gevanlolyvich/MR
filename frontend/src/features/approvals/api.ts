import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RiskLevel, RiskStatus } from "@/features/risks/types";

export interface ApprovalRiskRow {
  id: string;
  code: string;
  title: string;
  status: RiskStatus;
  updatedAt: string;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualScore: number | null;
  residualLevel: RiskLevel | null;
  branch: { code: string; name: string };
  category: { name: string };
  owner: { fullName: string };
}

export interface ApprovalMitigationRow {
  id: string;
  description: string;
  progress: number;
  status: string;
  dueDate: string | null;
  risk: { id: string; code: string; title: string; branchId: string };
  responsible: { fullName: string };
}

export interface ApprovalQueue {
  risks: ApprovalRiskRow[];
  mitigations: ApprovalMitigationRow[];
  counts: { risks: number; mitigations: number };
}

export type Decision = "APPROVE" | "REJECT" | "RETURN";

export const approvalKeys = {
  queue: ["approvals", "queue"] as const,
};

export async function fetchApprovalQueue() {
  const res = await api.get("/approvals");
  return res.data as ApprovalQueue;
}

function useWorkflowMutation<TBody>(path: (id: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: TBody }) => {
      await api.post(path(id), body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: approvalKeys.queue });
      void queryClient.invalidateQueries({ queryKey: ["risks"] });
      void queryClient.invalidateQueries({ queryKey: ["mitigations"] });
      void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export const useReviewRisk = () =>
  useWorkflowMutation<{ decision: Decision; note?: string }>((id) => `/approvals/${id}/review`);

export const useValidateRisk = () =>
  useWorkflowMutation<{ decision: Decision; note?: string }>((id) => `/approvals/${id}/validate`);

export const useVerifyRisk = () =>
  useWorkflowMutation<{ decision: Decision; note?: string }>((id) => `/approvals/${id}/verify`);

export const useSubmitResidual = () =>
  useWorkflowMutation<{ note?: string }>((id) => `/approvals/${id}/submit-residual`);

export const useVerifyMitigation = () =>
  useWorkflowMutation<{ decision: "APPROVE" | "REJECT"; note?: string }>((id) => `/mitigations/${id}/verify`);
