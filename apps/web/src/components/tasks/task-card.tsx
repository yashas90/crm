"use client";

import { type Task, useCompleteTask, useDeleteTask } from "@/hooks/use-tasks";
import { cn } from "@propninja/ui/lib/utils";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Trash2,
  Users,
} from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
  medium:
    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

const TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  meeting: Users,
  follow_up: MessageSquare,
  document: FileText,
  site_visit: MapPin,
  other: Circle,
};

function formatDue(dueAt: string | null) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const now = new Date();
  const overdue = d < now;
  const today = !overdue && d.toDateString() === now.toDateString();
  const str = d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return { str, overdue, today };
}

export function TaskCard({
  task,
  showLead = false,
  canDelete = false,
  selected = false,
  onSelect,
  onOpen,
  compact = false,
}: {
  task: Task;
  showLead?: boolean;
  canDelete?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onOpen?: (id: string) => void;
  compact?: boolean;
}) {
  const complete = useCompleteTask();
  const remove = useDeleteTask();
  const TypeIcon = TYPE_ICONS[task.taskType] ?? Circle;
  const due = formatDue(task.dueAt);
  const isDone = task.status === "completed" || task.status === "cancelled";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border p-3 transition-all duration-200",
        selected
          ? "border-[#204060]/40 bg-[#204060]/5"
          : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5",
        isDone ? "opacity-60" : "hover:border-slate-300 hover:shadow-md hover:-translate-y-px",
        compact && "p-2",
      )}
    >
      {onSelect ? (
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
          checked={selected}
          onChange={(e) => onSelect(task.id, e.target.checked)}
          aria-label={`Select ${task.title}`}
        />
      ) : null}

      <button
        type="button"
        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
        onClick={() => !isDone && complete.mutate(task.id)}
        disabled={isDone || complete.isPending}
        title={isDone ? "Completed" : "Mark complete"}
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen?.(task.id)}
        disabled={!onOpen}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className={cn("text-sm font-medium", isDone && "line-through")}>{task.title}</p>
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-xs font-medium",
              PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium,
            )}
          >
            {task.priority}
          </span>
        </div>

        {!compact && task.description ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {due ? (
            <span
              className={cn(
                "flex items-center gap-1",
                due.overdue && !isDone && "font-semibold text-rose-600",
                due.today && !isDone && "font-semibold text-amber-600",
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {due.overdue && !isDone ? "Overdue · " : due.today && !isDone ? "Today · " : ""}
              {due.str}
            </span>
          ) : null}
          {task.assigneeUser ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.assigneeUser.name}
            </span>
          ) : null}
          {showLead && task.lead ? (
            <span className="text-primary">
              {task.lead.firstName} {task.lead.lastName}
            </span>
          ) : null}
        </div>
      </button>

      {canDelete && !isDone ? (
        <button
          type="button"
          className="shrink-0 p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
          onClick={() => remove.mutate(task.id)}
          disabled={remove.isPending}
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
