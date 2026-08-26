"use client";

import { LEADS_DATE_PRESETS, type LeadsDatePreset } from "@/lib/leads-date-filters";
import { LEADS_TABLE_COLUMNS, type LeadsColumnVisibility } from "@/lib/leads-table-columns";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { CalendarDays, Columns3, Filter, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const dateSelectClass =
  "h-9 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LeadsFilterBarProps = {
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: () => void;
  datePreset: LeadsDatePreset;
  dateFrom?: string;
  dateTo?: string;
  onDatePresetChange: (preset: LeadsDatePreset, range?: { from?: string; to?: string }) => void;
  columns: LeadsColumnVisibility;
  onColumnsChange: (columns: LeadsColumnVisibility) => void;
  onOpenFilters: () => void;
  activeFilterCount?: number;
  className?: string;
};

export function LeadsFilterBar({
  searchDraft,
  onSearchDraftChange,
  onSearchSubmit,
  datePreset,
  dateFrom,
  dateTo,
  onDatePresetChange,
  columns,
  onColumnsChange,
  onOpenFilters,
  activeFilterCount = 0,
  className,
}: LeadsFilterBarProps) {
  const searchId = "leads-search";
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (columnsOpen && columnsRef.current && !columnsRef.current.contains(target)) {
        setColumnsOpen(false);
      }
      if (dateOpen && dateRef.current && !dateRef.current.contains(target)) {
        setDateOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsOpen, dateOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        document.getElementById(searchId)?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleColumnCount = LEADS_TABLE_COLUMNS.filter((column) => columns[column.id]).length;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center dark:bg-muted/10",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={searchId}
          className="h-10 rounded-full border-border bg-background pl-10 pr-16 shadow-sm transition-shadow focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
          placeholder="Search name, phone, or Lead ID…"
          value={searchDraft}
          onChange={(event) => onSearchDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearchSubmit();
            }
          }}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:flex">
          /
        </kbd>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="relative" ref={dateRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border bg-background text-foreground"
            onClick={() => setDateOpen((open) => !open)}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">
              {LEADS_DATE_PRESETS.find((preset) => preset.id === datePreset)?.label ?? "All"}
            </span>
          </Button>

          {dateOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Created date
              </p>
              <div className="space-y-2">
                <select
                  className={cn(dateSelectClass, "w-full")}
                  value={datePreset}
                  onChange={(event) => {
                    const preset = event.target.value as LeadsDatePreset;
                    onDatePresetChange(preset);
                    if (preset !== "custom") {
                      setDateOpen(false);
                    }
                  }}
                >
                  {LEADS_DATE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                {datePreset === "custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="leads-date-from" className="text-xs">
                        From
                      </Label>
                      <Input
                        id="leads-date-from"
                        type="date"
                        className="h-9"
                        value={dateFrom ?? ""}
                        onChange={(event) =>
                          onDatePresetChange("custom", {
                            from: event.target.value,
                            to: dateTo,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="leads-date-to" className="text-xs">
                        To
                      </Label>
                      <Input
                        id="leads-date-to"
                        type="date"
                        className="h-9"
                        value={dateTo ?? ""}
                        onChange={(event) =>
                          onDatePresetChange("custom", {
                            from: dateFrom,
                            to: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={columnsRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border bg-background text-foreground"
            onClick={() => setColumnsOpen((open) => !open)}
          >
            <Columns3 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Manage Columns</span>
          </Button>

          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Visible columns
              </p>
              <ul className="space-y-2">
                {LEADS_TABLE_COLUMNS.map((column) => {
                  const checked = columns[column.id];
                  const isLastVisible = checked && visibleColumnCount <= 1;

                  return (
                    <li key={column.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={checked}
                          disabled={isLastVisible}
                          onChange={(event) => {
                            onColumnsChange({
                              ...columns,
                              [column.id]: event.target.checked,
                            });
                          }}
                        />
                        <span>{column.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative h-9 gap-2 border-border bg-background text-foreground"
          onClick={onOpenFilters}
        >
          <Filter className="h-4 w-4 shrink-0" />
          Filter
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>
    </div>
  );
}
