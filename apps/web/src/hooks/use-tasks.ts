"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
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

export type TasksListData = {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
};

export type TasksQueryParams = {
  leadId?: string;
  assignedTo?: string;
  status?: TaskStatus;
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
    mutationFn: (id: string) => apiPost<Task>(`/api/tasks/${id}/complete`, {}),
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
