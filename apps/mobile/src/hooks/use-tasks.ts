import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const TASK_STALE_MS = 30_000;
const MY_OPEN_TASKS_KEY = ["tasks", "mine", "open"] as const;

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

type OpenTasksList = { items: Task[]; total: number; page: number; pageSize: number };

function isOpenTaskStatus(status: TaskStatus) {
  return status === "pending" || status === "in_progress";
}

async function syncTaskCaches(queryClient: QueryClient, taskId: string, leadId?: string | null) {
  const refetches: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" }),
    queryClient.invalidateQueries({ queryKey: ["task", taskId], refetchType: "active" }),
  ];
  if (leadId) {
    refetches.push(
      queryClient.invalidateQueries({
        queryKey: ["tasks", "lead", leadId],
        refetchType: "active",
      }),
    );
  }
  await Promise.all(refetches);
}

function removeTaskFromOpenLists(queryClient: QueryClient, taskId: string) {
  for (const key of [MY_OPEN_TASKS_KEY, ["tasks", "team", "due-today"] as const]) {
    queryClient.setQueryData<OpenTasksList>(key, (current) => {
      if (!current) return current;
      const items = current.items.filter((task) => task.id !== taskId);
      if (items.length === current.items.length) return current;
      return { ...current, items, total: Math.max(0, current.total - 1) };
    });
  }
}

async function fetchMyOpenTasks() {
  const data = await apiGet<OpenTasksList>("/api/tasks?assigneeId=me&status=open&pageSize=500");
  const items = [...data.items]
    .filter((task) => isOpenTaskStatus(task.status))
    .sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  // Prefer server total so the badge/count drops when completing (page may still be capped).
  return { ...data, items, total: Math.max(data.total ?? 0, items.length) };
}

function markTaskCompletedInCaches(
  queryClient: QueryClient,
  taskId: string,
  leadId?: string | null,
  completedAt = new Date().toISOString(),
) {
  queryClient.setQueryData<Task>(["task", taskId], (current) =>
    current ? { ...current, status: "completed", completedAt } : current,
  );

  if (leadId) {
    queryClient.setQueryData<OpenTasksList>(["tasks", "lead", leadId], (current) => {
      if (!current) return current;
      const items = current.items.map((task) =>
        task.id === taskId ? { ...task, status: "completed" as const, completedAt } : task,
      );
      return { ...current, items };
    });
  }

  removeTaskFromOpenLists(queryClient, taskId);
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
    staleTime: TASK_STALE_MS,
    meta: { suppressErrorToast: true },
  });
}

/** Canonical open-tasks query shared by Tasks tab, Profile badge, and navigation badge. */
export function useMyOpenTasks(options?: { enabled?: boolean }) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: MY_OPEN_TASKS_KEY,
    queryFn: fetchMyOpenTasks,
    enabled: (options?.enabled ?? true) && ready,
    staleTime: TASK_STALE_MS,
    meta: { suppressErrorToast: true },
  });
}

export const useMyTasks = useMyOpenTasks;
export const useTeamOpenTasks = useMyOpenTasks;

export function useTeamTasksDueToday() {
  const ready = useAuthReady();
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["tasks", "team", "due-today"],
    queryFn: () =>
      apiGet<{ items: Task[]; total: number; page: number; pageSize: number }>(
        `/api/tasks?status=open&dueBefore=${today}T23:59:59Z&pageSize=100`,
      ),
    enabled: ready,
    staleTime: TASK_STALE_MS,
    meta: { suppressErrorToast: true },
  });
}

export function useOpenTaskCount(options?: { enabled?: boolean }) {
  const { data } = useMyOpenTasks(options);
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
      await queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" });
      if (variables.leadId) {
        await queryClient.invalidateQueries({
          queryKey: ["tasks", "lead", variables.leadId],
          refetchType: "active",
        });
      }
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiPost<Task>(`/api/tasks/${taskId}/complete`, {}),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["task", taskId] });

      const previousOpen = queryClient.getQueryData<OpenTasksList>(MY_OPEN_TASKS_KEY);
      const previousTask = queryClient.getQueryData<Task>(["task", taskId]);
      const leadId =
        previousTask?.leadId ??
        previousOpen?.items.find((task) => task.id === taskId)?.leadId ??
        undefined;
      const previousLeadTasks = leadId
        ? queryClient.getQueryData<OpenTasksList>(["tasks", "lead", leadId])
        : undefined;

      markTaskCompletedInCaches(queryClient, taskId, leadId);

      return { previousOpen, previousTask, previousLeadTasks, leadId };
    },
    onError: (_error, taskId, context) => {
      if (context?.previousOpen) {
        queryClient.setQueryData(MY_OPEN_TASKS_KEY, context.previousOpen);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(["task", taskId], context.previousTask);
      }
      if (context?.previousLeadTasks && context.leadId) {
        queryClient.setQueryData(["tasks", "lead", context.leadId], context.previousLeadTasks);
      }
    },
    onSuccess: async (data, taskId) => {
      queryClient.setQueryData(["task", taskId], data);
      markTaskCompletedInCaches(
        queryClient,
        taskId,
        data.leadId,
        data.completedAt ?? new Date().toISOString(),
      );
      // Soft refresh in background — keep optimistic removal so the row stays gone.
      void queryClient.invalidateQueries({
        queryKey: MY_OPEN_TASKS_KEY,
        refetchType: "active",
      });
      if (data.leadId) {
        void queryClient.invalidateQueries({
          queryKey: ["tasks", "lead", data.leadId],
          refetchType: "active",
        });
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: Record<string, unknown> }) =>
      apiPatch<Task>(`/api/tasks/${taskId}`, payload),
    onSuccess: async (data, { taskId }) => {
      queryClient.setQueryData(["task", taskId], data);
      await syncTaskCaches(queryClient, taskId, data.leadId);
    },
  });
}
