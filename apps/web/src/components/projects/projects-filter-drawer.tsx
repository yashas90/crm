"use client";

import { useUsers } from "@/hooks/use-users";
import {
  PROJECT_STATUS_FILTER_OPTIONS,
  type ProjectsListFilters,
  defaultProjectsListFilters,
} from "@/lib/projects-list-filters";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ProjectsFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applied: ProjectsListFilters;
  onApply: (filters: ProjectsListFilters) => void;
};

export function ProjectsFilterDrawer({
  open,
  onOpenChange,
  applied,
  onApply,
}: ProjectsFilterDrawerProps) {
  const [draft, setDraft] = useState<ProjectsListFilters>(applied);
  const { data: users } = useUsers();

  useEffect(() => {
    if (open) {
      setDraft(applied);
    }
  }, [open, applied]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  function toggleStatus(status: ProjectsListFilters["statuses"][number]) {
    setDraft((current) => ({
      ...current,
      statuses: current.statuses.includes(status)
        ? current.statuses.filter((value) => value !== status)
        : [...current.statuses, status],
    }));
  }

  function handleReset() {
    const defaults = defaultProjectsListFilters();
    setDraft(defaults);
    onApply(defaults);
    onOpenChange(false);
  }

  function handleApply() {
    onApply(draft);
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close filters"
        onClick={() => onOpenChange(false)}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-black px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Filters</h3>
            <p className="text-sm text-muted-foreground">
              Refine status, assignee, and availability.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="space-y-3">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_STATUS_FILTER_OPTIONS.map((option) => {
                const selected = draft.statuses.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleStatus(option.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-muted",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projects-filter-assigned-to">Assigned To</Label>
            <select
              id="projects-filter-assigned-to"
              className={selectClass}
              value={draft.assignedTo}
              onChange={(event) =>
                setDraft((current) => ({ ...current, assignedTo: event.target.value }))
              }
            >
              <option value="">All users</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projects-filter-availability">Availability</Label>
            <select
              id="projects-filter-availability"
              className={selectClass}
              value={draft.availability}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  availability: event.target.value as ProjectsListFilters["availability"],
                }))
              }
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="unavailable">Not Available</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-black px-5 py-4">
          <Button type="button" variant="ghost" onClick={handleReset}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
