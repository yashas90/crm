import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIVE_REFETCH_MS = 30_000;

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "call" | "meeting" | "follow_up" | "document" | "site_visit" | "other";

export type Task = {
  id: string;
  leadId: string | null;
  assignedTo: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  taskType: TaskType;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeUser: { id: string; name: string } | null;
  lead: { id: string; firstName: string; lastName: string } | null;
};

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
}

export function useLeadTasks(leadId: string) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["tasks", "lead", leadId],
    queryFn: () =>
      apiGet<{ items: Task[]; total: number; page: number; pageSize: number }>(
        `/api/tasks?leadId=${leadId}&pageSize=50`,
      ),
    enabled: ready && Boolean(leadId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useMyTasks() {
  const ready = useAuthReady();
  const userId = getCurrentUserId();
  return useQuery({
    queryKey: ["tasks", "mine", userId],
    queryFn: () =>
      apiGet<{ items: Task[]; total: number; page: number; pageSize: number }>(
        `/api/tasks?assignedTo=${userId}&status=pending&pageSize=50`,
      ),
    enabled: ready && Boolean(userId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      taskType?: TaskType;
      priority?: TaskPriority;
      leadId?: string;
      dueAt?: string;
      description?: string;
    }) => apiPost<Task>("/api/tasks", input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (variables.leadId) {
        await queryClient.invalidateQueries({ queryKey: ["tasks", "lead", variables.leadId] });
      }
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiPost<Task>(`/api/tasks/${taskId}/complete`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: Record<string, unknown> }) =>
      apiPatch<Task>(`/api/tasks/${taskId}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
