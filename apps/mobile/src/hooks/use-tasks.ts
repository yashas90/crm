import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { LIVE_REFETCH_MS } from "@/lib/liveQuery";
import { useAuth } from "@/providers/auth-provider";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    queryClient.refetchQueries({ queryKey: ["tasks"], type: "all" }),
    queryClient.refetchQueries({ queryKey: ["task", taskId], type: "all" }),
  ];
  if (leadId) {
    refetches.push(
      queryClient.refetchQueries({ queryKey: ["tasks", "lead", leadId], type: "all" }),
    );
  }
  await Promise.all(refetches);
}

function removeTaskFromOpenLists(queryClient: QueryClient, taskId: string) {
  for (const key of [
    ["tasks", "mine", "open"] as const,
    ["tasks", "mine", "open-sorted"] as const,
    ["tasks", "team", "due-today"] as const,
  ]) {
    queryClient.setQueryData<OpenTasksList>(key, (current) => {
      if (!current) return current;
      const items = current.items.filter((task) => task.id !== taskId);
      if (items.length === current.items.length) return current;
      return { ...current, items, total: Math.max(0, current.total - 1) };
    });
  }
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
    staleTime: 0,
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
      const items = [...data.items]
        .filter((task) => isOpenTaskStatus(task.status))
        .sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });
      return { ...data, items, total: items.length };
    },
    enabled: ready,
    staleTime: 0,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

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
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useOpenTaskCount() {
  const { data } = useMyOpenTasks();
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
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousOpenSorted = queryClient.getQueryData<OpenTasksList>([
        "tasks",
        "mine",
        "open-sorted",
      ]);
      const previousOpen = queryClient.getQueryData<OpenTasksList>(["tasks", "mine", "open"]);
      const previousTask = queryClient.getQueryData<Task>(["task", taskId]);
      const leadId = previousTask?.leadId ?? undefined;
      const previousLeadTasks = leadId
        ? queryClient.getQueryData<OpenTasksList>(["tasks", "lead", leadId])
        : undefined;

      markTaskCompletedInCaches(queryClient, taskId, leadId);

      return { previousOpenSorted, previousOpen, previousTask, previousLeadTasks, leadId };
    },
    onError: (_error, taskId, context) => {
      if (context?.previousOpenSorted) {
        queryClient.setQueryData(["tasks", "mine", "open-sorted"], context.previousOpenSorted);
      }
      if (context?.previousOpen) {
        queryClient.setQueryData(["tasks", "mine", "open"], context.previousOpen);
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
      await syncTaskCaches(queryClient, taskId, data.leadId);
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
