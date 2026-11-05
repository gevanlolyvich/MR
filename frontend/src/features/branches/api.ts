import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface BranchRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; risks: number };
}

export interface BranchInput {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export const branchKeys = {
  list: (params: Record<string, unknown>) => ["branches", "manage", params] as const,
};

export async function fetchBranches(params: Record<string, unknown>) {
  const res = await api.get("/master/branches", { params });
  return res.data as { data: BranchRow[] };
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["branches"] });
    void queryClient.invalidateQueries({ queryKey: ["risks", "refs"] });
  };
}

export function useCreateBranch() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: BranchInput) => {
      const res = await api.post("/master/branches", body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateBranch() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: BranchInput }) => {
      const res = await api.put(`/master/branches/${id}`, body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSetBranchStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await api.patch(`/master/branches/${id}/status`, { isActive });
      return res.data;
    },
    onSuccess: invalidate,
  });
}
