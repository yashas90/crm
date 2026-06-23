"use client";

import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { Search } from "lucide-react";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type UsersListToolbarProps = {
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: () => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions: readonly number[];
  className?: string;
};

export function UsersListToolbar({
  searchDraft,
  onSearchDraftChange,
  onSearchSubmit,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  className,
}: UsersListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-2 border-black bg-background p-3 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
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
          aria-label="Search users by name or email"
        />
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <Label htmlFor="users-page-size" className="text-sm text-muted-foreground">
          Show Entries
        </Label>
        <select
          id="users-page-size"
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
  );
}
