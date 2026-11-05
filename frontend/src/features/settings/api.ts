import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SettingRow {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export const settingKeys = {
  list: ["settings"] as const,
};

export async function fetchSettings() {
  const res = await api.get("/settings");
  return res.data as { data: SettingRow[] };
}

export function useSettings() {
  return useQuery({ queryKey: settingKeys.list, queryFn: fetchSettings });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const res = await api.put("/settings", { settings });
      return res.data as { data: SettingRow[] };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: settingKeys.list }),
  });
}
