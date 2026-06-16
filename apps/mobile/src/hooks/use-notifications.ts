import { apiGet, apiPost } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIVE_REFETCH_MS = 30_000;

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

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

export function leadIdFromPayload(payload: Record<string, unknown>): string | null {
  const id = payload.leadId;
  return typeof id === "string" ? id : null;
}

export function formatNotificationType(type: string): string {
  switch (type) {
    case "lead_assigned":
      return "Lead assigned";
    case "followup_due":
      return "Follow-up due";
    case "task_assigned":
      return "Task assigned";
    default:
      return type.replace(/_/g, " ");
  }
}

export function formatNotificationLabel(notification: NotificationRow): string {
  const payload = notification.payload;
  const leadName = typeof payload.leadName === "string" ? payload.leadName : "Lead";

  if (notification.type === "lead_assigned") {
    const assignedBy = typeof payload.assignedBy === "string" ? payload.assignedBy : "Someone";
    return `${assignedBy} assigned you ${leadName}`;
  }

  if (notification.type === "followup_due") {
    return `Follow-up due for ${leadName}`;
  }

  if (notification.type === "task_assigned") {
    const taskTitle = typeof payload.taskTitle === "string" ? payload.taskTitle : "a task";
    return `You were assigned: ${taskTitle}`;
  }

  return leadName;
}

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated";
}

export function useNotifications() {
  const ready = useAuthReady();

  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => apiGet<NotificationsData>("/api/notifications"),
    enabled: ready,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useUnreadNotificationCount() {
  const query = useNotifications();
  return query.data?.unreadCount ?? 0;
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      apiPost<{ marked: number }>("/api/notifications/mark-read", { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
