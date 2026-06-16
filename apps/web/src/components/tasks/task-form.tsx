"use client";

import {
  type CreateTaskInput,
  type TaskPriority,
  type TaskType,
  useCreateTask,
} from "@/hooks/use-tasks";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useState } from "react";

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: "follow_up", label: "Follow-up" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site Visit" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
];

type Props = {
  leadId?: string;
  assignedTo?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function TaskForm({ leadId, assignedTo, onSuccess, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [taskType, setTaskType] = useState<TaskType>("follow_up");

  const create = useCreateTask();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const input: CreateTaskInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt: dueAt || undefined,
      priority,
      taskType,
      leadId,
      assignedTo,
    };
    create.mutate(input, { onSuccess });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title *</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Call back after site visit"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="task-type">Type</Label>
          <select
            id="task-type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as TaskType)}
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-priority">Priority</Label>
          <select
            id="task-priority"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-due">Due date & time</Label>
        <Input
          id="task-due"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc">Description</Label>
        <textarea
          id="task-desc"
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Optional details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending || !title.trim()}>
          {create.isPending ? "Creating..." : "Create task"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
