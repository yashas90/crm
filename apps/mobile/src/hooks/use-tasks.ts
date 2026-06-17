import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIVE_REFETCH_MS = 30_000;

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "call" | "meeting" | "follow_up" | "document" | "site_visit" | "other";

export type TaskNoteEntry = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

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
  notes?: string | null;
  noteEntries?: TaskNoteEntry[];
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
  return useQuery({
    queryKey: ["tasks", "mine", "open"],
    queryFn: () =>
      apiGet<{ items: Task[]; total: number; page: number; pageSize: number }>(
        "/api/tasks?assigneeId=me&status=open&pageSize=100",
      ),
    enabled: ready,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useMyOpenTasks() {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["tasks", "mine", "open-sorted"],
    queryFn: async () => {
      const data = await apiGet<{ items: Task[]; total: number; page: number; pageSize: number }>(
        "/api/tasks?assigneeId=me&status=open&pageSize=100",
      );
      const items = [...data.items].sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
      return { ...data, items };
    },
    enabled: ready,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useOpenTaskCount() {
  const { data } = useMyTasks();
  const total = data?.total ?? 0;
  return total > 0 ? total : undefined;
}

export function useTask(taskId: string) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => apiGet<Task>(`/api/tasks/${taskId}`),
    enabled: ready && Boolean(taskId),
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
    mutationFn: (taskId: string) => apiPatch<Task>(`/api/tasks/${taskId}/complete`, {}),
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
