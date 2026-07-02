"use client";

import type { UserRow } from "@/hooks/use-users";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";

type AgentMultiSelectProps = {
  id?: string;
  label?: string;
  users: UserRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  hint?: string;
  className?: string;
  isLoading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
};

function roleLabel(role: UserRow["role"]) {
  if (role === "agent") return "Agent";
  if (role === "manager") return "Manager";
  return "Admin";
}

export function AgentMultiSelect({
  id = "agent-multi-select",
  label = "Assign to agents",
  users,
  selectedIds,
  onChange,
  hint,
  className,
  isLoading = false,
  errorMessage,
  onRetry,
}: AgentMultiSelectProps) {
  const selectedSet = new Set(selectedIds);

  function toggle(userId: string) {
    if (selectedSet.has(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
      return;
    }
    onChange([...selectedIds, userId]);
  }

  function selectAll() {
    onChange(users.map((user) => user.id));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={selectAll}
          >
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={clearAll}
          >
            Clear
          </button>
        </div>
      </div>

      <fieldset
        id={id}
        className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-input bg-background p-2"
      >
        <legend className="sr-only">{label}</legend>
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading agents…</p>
        ) : users.length === 0 ? (
          <div className="space-y-2 px-2 py-3">
            <p className="text-sm text-muted-foreground">No agents available</p>
            {errorMessage ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">{errorMessage}</p>
            ) : null}
            {onRetry ? (
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={onRetry}
              >
                Retry loading agents
              </button>
            ) : null}
          </div>
        ) : (
          users.map((user) => {
            const checked = selectedSet.has(user.id);
            return (
              <label
                key={user.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60",
                  checked && "bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={checked}
                  onChange={() => toggle(user.id)}
                />
                <span className="flex-1 font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{roleLabel(user.role)}</span>
              </label>
            );
          })
        )}
      </fieldset>

      <p className="text-xs text-muted-foreground">
        {selectedIds.length === 0
          ? "Select at least one agent."
          : `${selectedIds.length} agent${selectedIds.length === 1 ? "" : "s"} selected`}
        {hint ? ` — ${hint}` : ""}
      </p>
    </div>
  );
}
