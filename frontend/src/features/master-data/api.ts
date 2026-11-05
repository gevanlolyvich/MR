import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CategoryRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { risks: number };
}

export interface CategoryInput {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export const categoryKeys = {
  list: (params: Record<string, unknown>) => ["categories", "manage", params] as const,
};

export async function fetchCategories(params: Record<string, unknown>) {
  const res = await api.get("/master/categories", { params });
  return res.data as { data: CategoryRow[] };
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
    void queryClient.invalidateQueries({ queryKey: ["risks", "refs"] });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: CategoryInput) => {
      const res = await api.post("/master/categories", body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CategoryInput }) => {
      const res = await api.put(`/master/categories/${id}`, body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSetCategoryStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await api.patch(`/master/categories/${id}/status`, { isActive });
      return res.data;
    },
    onSuccess: invalidate,
  });
}
