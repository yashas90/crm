"use client";

import { useBulkUserActions } from "@/hooks/use-bulk-users";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";

type UsersBulkActionsBarProps = {
  selectedIds: string[];
  onClearSelection: () => void;
  canUpdate?: boolean;
  className?: string;
};

export function UsersBulkActionsBar({
  selectedIds,
  onClearSelection,
  canUpdate = false,
  className,
}: UsersBulkActionsBarProps) {
  const bulk = useBulkUserActions();
  const selectedCount = selectedIds.length;

  if (selectedCount === 0) {
    return null;
  }

  async function handleSetActive(isActive: boolean) {
    const result = await bulk.setActive.mutateAsync({ userIds: selectedIds, isActive });
    if (result.succeeded.length > 0) {
      onClearSelection();
    }
  }

  return (
    <div className={cn("rounded-xl border border-primary/30 bg-primary/5 p-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          Selected: <span className="tabular-nums">{selectedCount}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canUpdate || bulk.isBusy}
            onClick={() => void handleSetActive(true)}
          >
            Activate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={!canUpdate || bulk.isBusy}
            onClick={() => void handleSetActive(false)}
          >
            Deactivate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={bulk.isBusy}
            onClick={onClearSelection}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
