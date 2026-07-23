"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsData = {
  items: NotificationRow[];
  unreadCount: number;
};

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationsData>("/api/notifications"),
    enabled,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
    meta: { suppressErrorToast: true },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiPost<{ marked: number }>("/api/notifications/mark-read", { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
