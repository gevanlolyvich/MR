import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type RoleName = "MR" | "RISK_OFFICER" | "RISK_OWNER";

export interface UserRow {
  id: string;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { name: RoleName };
  branch: { id: string; code: string; name: string } | null;
}

export interface UserListResponse {
  data: UserRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface UserInput {
  username: string;
  email: string;
  fullName: string;
  role: RoleName;
  branchId?: string | null;
  password?: string;
}

export const userKeys = {
  list: (params: Record<string, unknown>) => ["users", "list", params] as const,
};

export async function fetchUsers(params: Record<string, unknown>) {
  const res = await api.get("/users", { params });
  return res.data as UserListResponse;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: UserInput) => {
      const res = await api.post("/users", body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<UserInput> & { isActive?: boolean } }) => {
      const res = await api.put(`/users/${id}`, body);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/users/${id}/reset-password`, {});
      return res.data as { temporaryPassword: string };
    },
  });
}

export function useSetUserStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await api.patch(`/users/${id}/status`, { isActive });
      return res.data;
    },
    onSuccess: invalidate,
  });
}
