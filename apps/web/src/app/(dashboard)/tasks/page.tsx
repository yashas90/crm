"use client";

import { TaskCard } from "@/components/tasks/task-card";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { type TaskFilters, TaskFiltersBar } from "@/components/tasks/task-filters-bar";
import { TaskFormSheet } from "@/components/tasks/task-form-sheet";
import { TasksBulkActionsBar } from "@/components/tasks/tasks-bulk-actions-bar";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { useTasks } from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { Card, CardContent } from "@propninja/ui/card";
import { CheckSquare, Plus } from "lucide-react";
import { useMemo, useState } from "react";

function dateToIsoEnd(date: string) {
  if (!date) return undefined;
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function dateToIsoStart(date: string) {
  if (!date) return undefined;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function TasksPage() {
  const { session } = useSession();
  const { hasPermission, isAdmin, isManager } = usePermissions();
  const canDelete = hasPermission("tasks:delete");
  const canManage = isAdmin || isManager;

  const [filters, setFilters] = useState<TaskFilters>({
    status: "open",
    priority: "",
    assignedTo: "",
    dueAfter: "",
    dueBefore: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { pageSize: "100" };
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.assignedTo) params.assignedTo = filters.assignedTo;
    else if (!canManage && session?.id) params.assigneeId = "me";
    const dueAfter = dateToIsoStart(filters.dueAfter);
    const dueBefore = dateToIsoEnd(filters.dueBefore);
    if (dueAfter) params.dueAfter = dueAfter;
    if (dueBefore) params.dueBefore = dueBefore;
    return params;
  }, [filters, canManage, session?.id]);

  const { data, isLoading } = useTasks(queryParams);
  const tasks = data?.items ?? [];

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage follow-ups, meetings, and action items.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add task
        </Button>
      </div>

      <TaskFiltersBar filters={filters} onChange={setFilters} showAssignee={canManage} />

      <TasksBulkActionsBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        canManage={canManage}
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg font-medium">No tasks</p>
            <p className="text-sm text-muted-foreground">
              Create tasks to track follow-ups and action items.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showLead
              canDelete={canDelete}
              selected={selectedIds.includes(task.id)}
              onSelect={handleSelect}
              onOpen={setDetailTaskId}
            />
          ))}
          <p className="text-xs text-muted-foreground">
            {tasks.length} of {data?.total ?? tasks.length} task
            {(data?.total ?? tasks.length) !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <TaskFormSheet open={showForm} onOpenChange={setShowForm} />
      <TaskDetailSheet
        taskId={detailTaskId}
        open={Boolean(detailTaskId)}
        onOpenChange={(open) => {
          if (!open) setDetailTaskId(null);
        }}
      />
    </div>
  );
}
