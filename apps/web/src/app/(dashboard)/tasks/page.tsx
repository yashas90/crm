"use client";

import { TaskCard } from "@/components/tasks/task-card";
import { TaskForm } from "@/components/tasks/task-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { type TaskStatus, useTasks } from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { CheckSquare, Plus } from "lucide-react";
import { useState } from "react";

const STATUS_TABS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All open" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export default function TasksPage() {
  const { session } = useSession();
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission("tasks:delete");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [myOnly, setMyOnly] = useState(false);

  const params = {
    status: statusFilter === "all" ? undefined : statusFilter,
    assignedTo: myOnly ? session?.id : undefined,
    pageSize: "100",
  };

  const { data, isLoading } = useTasks(params);
  const tasks = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage follow-ups, meetings, and action items.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          New task
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create task</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border/60 bg-muted/30 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                statusFilter === tab.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMyOnly((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
            myOnly
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          My tasks
        </button>
      </div>

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
              Create first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} showLead canDelete={canDelete} />
          ))}
          <p className="text-xs text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
