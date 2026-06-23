"use client";

import type { TaskPriority, TaskStatus } from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { Filter } from "lucide-react";

export type TaskFilters = {
  status: TaskStatus | "open" | "";
  priority: TaskPriority | "";
  assignedTo: string;
  dueAfter: string;
  dueBefore: string;
};

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type TaskFiltersBarProps = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  showAssignee?: boolean;
};

export function TaskFiltersBar({ filters, onChange, showAssignee = true }: TaskFiltersBarProps) {
  const { data: users } = useUsers();

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-muted/20 p-4 dark:border-white/10">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filters
      </div>

      <div className="space-y-1">
        <Label htmlFor="task-filter-status" className="text-xs">
          Status
        </Label>
        <select
          id="task-filter-status"
          className={selectClass}
          value={filters.status}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as TaskFilters["status"] })
          }
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="task-filter-priority" className="text-xs">
          Priority
        </Label>
        <select
          id="task-filter-priority"
          className={selectClass}
          value={filters.priority}
          onChange={(e) =>
            onChange({ ...filters, priority: e.target.value as TaskFilters["priority"] })
          }
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {showAssignee ? (
        <div className="space-y-1">
          <Label htmlFor="task-filter-assignee" className="text-xs">
            Assigned agent
          </Label>
          <select
            id="task-filter-assignee"
            className={selectClass}
            value={filters.assignedTo}
            onChange={(e) => onChange({ ...filters, assignedTo: e.target.value })}
          >
            <option value="">All agents</option>
            {(users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="task-filter-due-from" className="text-xs">
          Due from
        </Label>
        <Input
          id="task-filter-due-from"
          type="date"
          className="h-10 w-40"
          value={filters.dueAfter}
          onChange={(e) => onChange({ ...filters, dueAfter: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="task-filter-due-to" className="text-xs">
          Due to
        </Label>
        <Input
          id="task-filter-due-to"
          type="date"
          className="h-10 w-40"
          value={filters.dueBefore}
          onChange={(e) => onChange({ ...filters, dueBefore: e.target.value })}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({ status: "open", priority: "", assignedTo: "", dueAfter: "", dueBefore: "" })
        }
      >
        Reset
      </Button>
    </div>
  );
}
