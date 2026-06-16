"use client";

import { TaskCard } from "@/components/tasks/task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useTasks } from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { CheckSquare, Plus } from "lucide-react";
import { useState } from "react";

export function TasksPanel({ leadId, assignedTo }: { leadId: string; assignedTo?: string }) {
  const [showForm, setShowForm] = useState(false);
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission("tasks:delete");

  const pending = useTasks({ leadId, status: "pending", pageSize: "50" });
  const inProgress = useTasks({ leadId, status: "in_progress", pageSize: "50" });
  const completed = useTasks({ leadId, status: "completed", pageSize: "20" });

  const activeTasks = [...(pending.data?.items ?? []), ...(inProgress.data?.items ?? [])];
  const doneTasks = completed.data?.items ?? [];

  const isLoading = pending.isLoading || inProgress.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            Tasks
            {activeTasks.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {activeTasks.length}
              </span>
            ) : null}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add task
        </Button>
      </div>

      {showForm ? (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <TaskForm
            leadId={leadId}
            assignedTo={assignedTo}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tasks...</p>
      ) : activeTasks.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground">No open tasks. Add one to stay on track.</p>
      ) : (
        <div className="space-y-2">
          {activeTasks.map((task) => (
            <TaskCard key={task.id} task={task} canDelete={canDelete} />
          ))}
        </div>
      )}

      {doneTasks.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {doneTasks.length} completed task{doneTasks.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
