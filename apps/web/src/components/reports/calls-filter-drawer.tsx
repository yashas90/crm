"use client";

import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import {
  CALLS_LEAD_SOURCE_OPTIONS,
  type CallsReportDatePreset,
  type CallsReportFilterState,
  defaultCallsReportFilters,
} from "@/lib/calls-report-filters";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DATE_PRESETS: { id: CallsReportDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "custom", label: "Custom" },
];

type CallsFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applied: CallsReportFilterState;
  onApply: (filters: CallsReportFilterState) => void;
};

export function CallsFilterDrawer({
  open,
  onOpenChange,
  applied,
  onApply,
}: CallsFilterDrawerProps) {
  const [draft, setDraft] = useState<CallsReportFilterState>(applied);
  const { data: users } = useUsers();
  const { data: projects } = useProjects();

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

  function toggleUser(userId: string) {
    setDraft((current) => {
      const userIds = current.userIds.includes(userId)
        ? current.userIds.filter((id) => id !== userId)
        : [...current.userIds, userId];
      return {
        ...current,
        userIds,
        withTeam: userIds.length === 0 ? false : current.withTeam,
      };
    });
  }

  function handleReset() {
    const defaults = defaultCallsReportFilters();
    setDraft(defaults);
    onApply(defaults);
    onOpenChange(false);
  }

  function handleSearch() {
    onApply(draft);
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close filters"
        onClick={() => onOpenChange(false)}
      />
      <section className="relative z-10 max-h-[85vh] overflow-y-auto border-b border-border bg-background shadow-xl">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Advanced filters</h3>
              <p className="text-sm text-muted-foreground">
                Refine call report by user, lead source, project, and date.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label>User</Label>
                <div className="max-h-36 overflow-y-auto rounded-md border border-input bg-background p-2">
                  {users?.length ? (
                    users.map((user) => {
                      const checked = draft.userIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input"
                            checked={checked}
                            onChange={() => toggleUser(user.id)}
                          />
                          <span className="truncate">{user.name}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="px-2 py-1 text-sm text-muted-foreground">No users found.</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={draft.withTeam}
                    disabled={draft.userIds.length === 0}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, withTeam: event.target.checked }))
                    }
                  />
                  <span>With Team</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Include direct reports of the selected user(s). Select at least one user first.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calls-filter-source">Source</Label>
                <select
                  id="calls-filter-source"
                  className={selectClass}
                  value={draft.source}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, source: event.target.value }))
                  }
                >
                  <option value="">All sources</option>
                  {CALLS_LEAD_SOURCE_OPTIONS.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calls-filter-sub-source">Sub-Source</Label>
                <Input
                  id="calls-filter-sub-source"
                  placeholder="Sub-source"
                  value={draft.subSource}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, subSource: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calls-filter-project-status">Project Status</Label>
                <select
                  id="calls-filter-project-status"
                  className={selectClass}
                  value={draft.projectStatus}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      projectStatus: event.target.value as CallsReportFilterState["projectStatus"],
                    }))
                  }
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calls-filter-project">Project</Label>
                <select
                  id="calls-filter-project"
                  className={selectClass}
                  value={draft.projectName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, projectName: event.target.value }))
                  }
                >
                  <option value="">All projects</option>
                  {projects?.map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calls-filter-campaign">Campaign Name</Label>
                <Input
                  id="calls-filter-campaign"
                  placeholder="Campaign name"
                  value={draft.campaignName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, campaignName: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3 border-2 border-black bg-muted/10 p-4">
              <Label>Date filters</Label>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => {
                  const active = draft.datePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, datePreset: preset.id }))}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_#000]"
                          : "border border-input bg-background text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {draft.datePreset === "custom" ? (
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="calls-filter-from">From</Label>
                    <Input
                      id="calls-filter-from"
                      type="date"
                      value={draft.dateFrom ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, dateFrom: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="calls-filter-to">To</Label>
                    <Input
                      id="calls-filter-to"
                      type="date"
                      value={draft.dateTo ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, dateTo: event.target.value }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-black pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button type="button" onClick={handleSearch}>
              Search
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
