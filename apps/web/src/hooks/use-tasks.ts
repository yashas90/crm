"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

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

export type TasksListData = {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
};

export type TasksQueryParams = {
  leadId?: string;
  assignedTo?: string;
  assigneeId?: string;
  status?: TaskStatus | "open";
  priority?: TaskPriority;
  dueBefore?: string;
  dueAfter?: string;
  page?: string;
  pageSize?: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  dueAt?: string;
  priority?: TaskPriority;
  taskType?: TaskType;
  leadId?: string;
  assignedTo?: string;
};

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  status?: TaskStatus;
  assignedTo?: string | null;
  dueAt?: string | null;
};

export type BulkTaskResult = {
  succeeded: string[];
  failed: string[];
};

function buildUrl(base: string, params?: Record<string, string | undefined>) {
  if (!params) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

function tasksQueryKey(params?: TasksQueryParams) {
  return ["tasks", params ?? {}] as const;
}

export function useTasks(params?: TasksQueryParams) {
  return useQuery({
    queryKey: tasksQueryKey(params),
    queryFn: () =>
      apiGet<TasksListData>(buildUrl("/api/tasks", params as Record<string, string | undefined>)),
  });
}

export function useTasksDueToday() {
  return useQuery({
    queryKey: ["tasks", "due-today"],
    queryFn: () =>
      apiGet<TasksListData>(
        `/api/tasks?assigneeId=me&status=open&dueAfter=${encodeURIComponent(new Date(new Date().setHours(0, 0, 0, 0)).toISOString())}&dueBefore=today&pageSize=20`,
      ),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => apiGet<Task>(`/api/tasks/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiPost<Task>("/api/tasks", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => apiPatch<Task>(`/api/tasks/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["task", id] });
    },
    onError: () => toast.error("Failed to update task"),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Task>(`/api/tasks/${id}/complete`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task marked complete");
    },
    onError: () => toast.error("Failed to complete task"),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/api/tasks/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });
}

export function useAddTaskNote(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      apiPost<{ noteEntries: TaskNoteEntry[] }>(`/api/tasks/${taskId}/notes`, { text }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task", taskId] });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Comment added");
    },
    onError: () => toast.error("Failed to add comment"),
  });
}

export function useBulkTaskActions() {
  const qc = useQueryClient();

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["tasks"] });

  const complete = useMutation({
    mutationFn: (taskIds: string[]) =>
      apiPost<BulkTaskResult>("/api/tasks/bulk", { action: "complete", taskIds }),
    onSuccess: (result) => {
      invalidate();
      toast.success(`${result.succeeded.length} task(s) completed`);
    },
    onError: () => toast.error("Bulk complete failed"),
  });

  const reassign = useMutation({
    mutationFn: ({ taskIds, assignedTo }: { taskIds: string[]; assignedTo: string }) =>
      apiPost<BulkTaskResult>("/api/tasks/bulk", { action: "reassign", taskIds, assignedTo }),
    onSuccess: (result) => {
      invalidate();
      toast.success(`${result.succeeded.length} task(s) reassigned`);
    },
    onError: () => toast.error("Bulk reassign failed"),
  });

  const remove = useMutation({
    mutationFn: (taskIds: string[]) =>
      apiPost<BulkTaskResult>("/api/tasks/bulk", { action: "delete", taskIds }),
    onSuccess: (result) => {
      invalidate();
      toast.success(`${result.succeeded.length} task(s) deleted`);
    },
    onError: () => toast.error("Bulk delete failed"),
  });

  return { complete, reassign, delete: remove };
}
