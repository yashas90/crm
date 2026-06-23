"use client";

import {
  PROJECTS_TABLE_COLUMNS,
  type ProjectsColumnVisibility,
  visibleProjectsDataColumnCount,
} from "@/lib/projects-table-columns";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { Columns3, Filter, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ProjectsListToolbarProps = {
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: () => void;
  columns: ProjectsColumnVisibility;
  onColumnsChange: (columns: ProjectsColumnVisibility) => void;
  onOpenFilters: () => void;
  activeFilterCount?: number;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions: readonly number[];
  className?: string;
};

export function ProjectsListToolbar({
  searchDraft,
  onSearchDraftChange,
  onSearchSubmit,
  columns,
  onColumnsChange,
  onOpenFilters,
  activeFilterCount = 0,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  className,
}: ProjectsListToolbarProps) {
  const searchId = "projects-search";
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (columnsOpen && columnsRef.current && !columnsRef.current.contains(target)) {
        setColumnsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsOpen]);

  const visibleColumnCount = visibleProjectsDataColumnCount(columns);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-background p-3 lg:flex-row lg:items-center dark:border-white/10",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={searchId}
          type="search"
          className="h-10 rounded-lg pl-9"
          placeholder="Type to search"
          value={searchDraft}
          onChange={(event) => onSearchDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearchSubmit();
            }
          }}
          aria-label="Search projects by name"
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="relative" ref={columnsRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => setColumnsOpen((open) => !open)}
          >
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">Manage Columns</span>
          </Button>

          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-[#0f1623]">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Visible columns</p>
              <ul className="space-y-2">
                {PROJECTS_TABLE_COLUMNS.map((column) => {
                  const checked = columns[column.id];
                  const isLastVisible = checked && visibleColumnCount <= 1;

                  return (
                    <li key={column.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
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
          className="relative h-9 gap-2"
          onClick={onOpenFilters}
        >
          <Filter className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>

        <div className="flex items-center gap-2">
          <Label htmlFor="projects-page-size" className="text-sm text-muted-foreground">
            Show Entries
          </Label>
          <select
            id="projects-page-size"
            className={selectClass}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
