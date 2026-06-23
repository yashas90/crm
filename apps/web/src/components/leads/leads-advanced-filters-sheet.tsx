"use client";

import {
  AD_LEADS_FILTER_VALUE,
  AD_PLATFORM_SOURCE_OPTIONS,
  OTHER_LEAD_SOURCE_OPTIONS,
} from "@/lib/lead-sources";
import type { LeadsStage } from "@/lib/leads-stage";
import type { LeadsUrlFilters } from "@/lib/leads-url-filters";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

const STATUSES = ["", "new", "contacted", "qualified", "negotiation", "won", "lost"] as const;
const TEMPERATURES = ["", "cold", "warm", "hot"] as const;
const TEMP_CHIP: Record<string, string> = {
  "": "bg-muted text-muted-foreground",
  cold: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  warm: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  hot: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LeadsAdvancedFiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LeadsUrlFilters;
  onApply: (filters: LeadsUrlFilters) => void;
  onStageChange: (stage: LeadsStage) => void;
};

export function LeadsAdvancedFiltersSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  onStageChange,
}: LeadsAdvancedFiltersSheetProps) {
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

  const sourceSelectValue = filters.adLeadsOnly ? AD_LEADS_FILTER_VALUE : filters.source;

  function handleSourceChange(value: string) {
    if (value === AD_LEADS_FILTER_VALUE) {
      onApply({ ...filters, adLeadsOnly: true, source: "" });
      return;
    }
    onApply({ ...filters, adLeadsOnly: false, source: value });
  }

  function handleClear() {
    onApply({
      ...filters,
      status: "",
      source: "",
      adLeadsOnly: false,
      temperature: "",
      followUpFilter: "",
      tags: "",
      activeOnly: false,
    });
    onStageChange("active");
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
            <p className="text-sm text-muted-foreground">Refine status, source, and more.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="adv-status">Status</Label>
            <select
              id="adv-status"
              className={selectClass}
              value={filters.status}
              onChange={(event) => {
                const status = event.target.value;
                onApply({ ...filters, status, activeOnly: false });
                if (status === "new") onStageChange("new");
                else if (status === "contacted") onStageChange("pending");
                else if (status === "qualified") onStageChange("eoi");
                else if (!status) onStageChange("active");
              }}
            >
              {STATUSES.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? value.charAt(0).toUpperCase() + value.slice(1) : "All statuses"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adv-source">Source</Label>
            <select
              id="adv-source"
              className={selectClass}
              value={sourceSelectValue}
              onChange={(event) => handleSourceChange(event.target.value)}
            >
              <option value="">All sources</option>
              <optgroup label="Ad platforms">
                <option value={AD_LEADS_FILTER_VALUE}>All Ad Leads</option>
                {AD_PLATFORM_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other">
                {OTHER_LEAD_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Temperature</Label>
            <div className="flex flex-wrap gap-2">
              {TEMPERATURES.map((value) => (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => onApply({ ...filters, temperature: value })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                    filters.temperature === value
                      ? "bg-primary text-primary-foreground"
                      : (TEMP_CHIP[value] ?? "bg-muted text-muted-foreground"),
                  )}
                >
                  {value || "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Follow-up</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["", "All"],
                  ["due_today", "Due today"],
                  ["overdue", "Overdue"],
                  ["upcoming", "Upcoming"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value || "all"}
                  variant={filters.followUpFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    onApply({ ...filters, followUpFilter: value });
                    if (value === "overdue") onStageChange("overdue");
                    else if (value === "upcoming" || value === "due_today") {
                      onStageChange("scheduled");
                    } else if (!value) {
                      onStageChange("active");
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adv-tags">Tags</Label>
            <Input
              id="adv-tags"
              placeholder="e.g. hot, vip, ad_lead"
              value={filters.tags}
              onChange={(event) => onApply({ ...filters, tags: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Shows leads that have any of these tags.
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-black px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={handleClear}>
            Clear
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </aside>
    </div>
  );
}
