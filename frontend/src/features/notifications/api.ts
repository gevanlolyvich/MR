import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationResponse {
  data: NotificationRow[];
  unread: number;
}

export const notificationKeys = {
  list: ["notifications"] as const,
};

export async function fetchNotifications() {
  const res = await api.get("/notifications", { params: { limit: 12 } });
  return res.data as NotificationResponse;
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/read-all");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
  });
}
