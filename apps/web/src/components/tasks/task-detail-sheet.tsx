"use client";

import { TaskSlideOver } from "@/components/tasks/task-slide-over";
import { useAddTaskNote, useCompleteTask, useTask } from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { CalendarClock, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

type TaskDetailSheetProps = {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskDetailSheet({ taskId, open, onOpenChange }: TaskDetailSheetProps) {
  const { data: task, isLoading } = useTask(taskId ?? "");
  const complete = useCompleteTask();
  const addNote = useAddTaskNote(taskId ?? "");
  const [noteText, setNoteText] = useState("");

  const isDone = task?.status === "completed" || task?.status === "cancelled";

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNote.mutate(noteText.trim(), {
      onSuccess: () => setNoteText(""),
    });
  }

  return (
    <TaskSlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={task?.title ?? "Task details"}
      description={
        task ? `${task.taskType.replace(/_/g, " ")} · ${task.status.replace(/_/g, " ")}` : undefined
      }
      footer={
        task && !isDone ? (
          <Button
            className="w-full"
            onClick={() => complete.mutate(task.id, { onSuccess: () => onOpenChange(false) })}
            disabled={complete.isPending}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark complete
          </Button>
        ) : null
      }
    >
      {isLoading || !task ? (
        <p className="text-sm text-muted-foreground">Loading task...</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-xs font-medium capitalize",
                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium,
              )}
            >
              {task.priority}
            </span>
            {task.dueAt ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(task.dueAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            ) : null}
          </div>

          {task.description ? (
            <div>
              <h4 className="text-sm font-semibold">Description</h4>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          ) : null}

          {task.assigneeUser ? (
            <div>
              <h4 className="text-sm font-semibold">Assignee</h4>
              <p className="mt-1 text-sm text-muted-foreground">{task.assigneeUser.name}</p>
            </div>
          ) : null}

          {task.lead ? (
            <div>
              <h4 className="text-sm font-semibold">Linked lead</h4>
              <Link
                href={`/leads/${task.lead.id}`}
                className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {task.lead.firstName} {task.lead.lastName}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}

          <div>
            <h4 className="text-sm font-semibold">History & comments</h4>
            <div className="mt-2 space-y-3">
              {(task.noteEntries ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                (task.noteEntries ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-200/80 bg-muted/20 p-3 dark:border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.authorName}</span>
                      <span>
                        {new Date(entry.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{entry.text}</p>
                  </div>
                ))
              )}
            </div>

            {!isDone ? (
              <form onSubmit={handleAddNote} className="mt-4 space-y-2">
                <Label htmlFor="task-note">Add comment</Label>
                <textarea
                  id="task-note"
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={!noteText.trim() || addNote.isPending}>
                  {addNote.isPending ? "Saving..." : "Add comment"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </TaskSlideOver>
  );
}
