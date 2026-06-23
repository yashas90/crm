"use client";

import { TaskSlideOver } from "@/components/tasks/task-slide-over";
import { useLeads } from "@/hooks/use-leads";
import { useSession } from "@/hooks/use-session";
import {
  type CreateTaskInput,
  type TaskPriority,
  type TaskType,
  useCreateTask,
} from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useMemo, useState } from "react";

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

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type TaskFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLeadId?: string;
  defaultAssignedTo?: string;
};

export function TaskFormSheet({
  open,
  onOpenChange,
  defaultLeadId,
  defaultAssignedTo,
}: TaskFormSheetProps) {
  const { session } = useSession();
  const { data: users } = useUsers();
  const create = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [taskType, setTaskType] = useState<TaskType>("follow_up");
  const [leadId, setLeadId] = useState(defaultLeadId ?? "");
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo ?? session?.id ?? "");
  const [leadSearch, setLeadSearch] = useState("");

  const leadsQuery = useLeads(
    { search: leadSearch, page: "1", pageSize: "20" },
    { enabled: open && leadSearch.length >= 2 },
  );

  const leadOptions = useMemo(() => leadsQuery.data?.items ?? [], [leadsQuery.data]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setDueAt("");
    setPriority("medium");
    setTaskType("follow_up");
    setLeadId(defaultLeadId ?? "");
    setAssignedTo(defaultAssignedTo ?? session?.id ?? "");
    setLeadSearch("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const input: CreateTaskInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      priority,
      taskType,
      leadId: leadId || undefined,
      assignedTo: assignedTo || undefined,
    };

    create.mutate(input, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  }

  return (
    <TaskSlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Add task"
      description="Create a follow-up, call, or action item."
      footer={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-task-form"
            className="flex-1"
            disabled={create.isPending || !title.trim()}
          >
            {create.isPending ? "Creating..." : "Create task"}
          </Button>
        </div>
      }
    >
      <form id="add-task-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sheet-task-title">Title *</Label>
          <Input
            id="sheet-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Call back after site visit"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sheet-task-desc">Description</Label>
          <textarea
            id="sheet-task-desc"
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sheet-task-type">Type</Label>
            <select
              id="sheet-task-type"
              className={selectClass}
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
            <Label htmlFor="sheet-task-priority">Priority</Label>
            <select
              id="sheet-task-priority"
              className={selectClass}
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
          <Label htmlFor="sheet-task-due">Due date & time</Label>
          <Input
            id="sheet-task-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sheet-task-lead-search">Lead</Label>
          <Input
            id="sheet-task-lead-search"
            placeholder="Search leads by name or phone..."
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
          />
          {leadId ? (
            <p className="text-xs text-muted-foreground">
              Selected lead ID: {leadId}{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setLeadId("")}
              >
                clear
              </button>
            </p>
          ) : null}
          {leadSearch.length >= 2 ? (
            <div className="max-h-40 overflow-y-auto rounded-md border border-black">
              {leadsQuery.isLoading ? (
                <p className="p-2 text-xs text-muted-foreground">Searching...</p>
              ) : leadOptions.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No leads found</p>
              ) : (
                leadOptions.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setLeadId(lead.id);
                      setLeadSearch(`${lead.firstName} ${lead.lastName}`.trim());
                    }}
                  >
                    {lead.firstName} {lead.lastName}
                    {lead.phone ? ` · ${lead.phone}` : ""}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sheet-task-assignee">Assignee</Label>
          <select
            id="sheet-task-assignee"
            className={selectClass}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            {(users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </TaskSlideOver>
  );
}
