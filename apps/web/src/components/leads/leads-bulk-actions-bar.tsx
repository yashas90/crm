"use client";

import { AgentMultiSelect } from "@/components/leads/agent-multi-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkLeadActions } from "@/hooks/use-bulk-leads";
import { usePermissions } from "@/hooks/use-permissions";
import { useSession } from "@/hooks/use-session";
import { useUsers } from "@/hooks/use-users";
import { roundRobinDistributionLabel } from "@/lib/round-robin";
import { LEAD_STATUSES, type LeadStatus } from "@propninja/types/enums";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { forwardRef, useEffect, useState } from "react";

export type BulkActionIntent = "status" | "assign" | "delete";

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LeadsBulkActionsBarProps = {
  selectedIds: string[];
  onClearSelection: () => void;
  showHint?: boolean;
  onDismissHint?: () => void;
  pendingAction?: BulkActionIntent | null;
  onPendingActionHandled?: () => void;
  className?: string;
};

export const LeadsBulkActionsBar = forwardRef<HTMLDivElement, LeadsBulkActionsBarProps>(
  function LeadsBulkActionsBar(
    {
      selectedIds,
      onClearSelection,
      showHint,
      onDismissHint,
      pendingAction,
      onPendingActionHandled,
      className,
    },
    ref,
  ) {
    const { canAssignLead, canDeleteLead } = usePermissions();
    const { session } = useSession();
    const { data: users } = useUsers();
    const bulk = useBulkLeadActions();

    const [statusOpen, setStatusOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [status, setStatus] = useState<LeadStatus>("contacted");
    const [assignUserIds, setAssignUserIds] = useState<string[]>([]);

    const selectedCount = selectedIds.length;
    const hasSelection = selectedCount > 0;

    useEffect(() => {
      if (!pendingAction || !hasSelection) return;

      if (pendingAction === "status") setStatusOpen(true);
      if (pendingAction === "assign") {
        setAssignUserIds(session?.id ? [session.id] : []);
        setAssignOpen(true);
      }
      if (pendingAction === "delete") setDeleteOpen(true);

      onPendingActionHandled?.();
    }, [pendingAction, hasSelection, onPendingActionHandled, session?.id]);

    async function handleStatusSubmit() {
      const result = await bulk.updateStatus.mutateAsync({
        leadIds: selectedIds,
        leadStatus: status,
      });
      setStatusOpen(false);
      if (result.succeeded.length > 0) {
        onClearSelection();
      }
      onDismissHint?.();
    }

    async function handleAssignSubmit() {
      if (assignUserIds.length === 0) return;
      const result = await bulk.assign.mutateAsync({
        leadIds: selectedIds,
        userIds: assignUserIds,
      });
      setAssignOpen(false);
      setAssignUserIds([]);
      if (result.succeeded.length > 0) {
        onClearSelection();
      }
      onDismissHint?.();
    }

    async function handleDeleteSubmit() {
      const result = await bulk.archive.mutateAsync(selectedIds);
      setDeleteOpen(false);
      if (result.succeeded.length > 0) {
        onClearSelection();
      }
      onDismissHint?.();
    }

    if (!hasSelection && !showHint) {
      return <div ref={ref} className={className} />;
    }

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "border-2 border-black bg-muted/20 p-3",
            hasSelection && "border-primary/30 bg-primary/5",
            className,
          )}
        >
          {showHint && !hasSelection ? (
            <p className="text-sm text-muted-foreground">
              Select one or more leads using the checkboxes, then use bulk actions below.
              <button
                type="button"
                className="ml-2 font-medium text-primary hover:underline"
                onClick={onDismissHint}
              >
                Dismiss
              </button>
            </p>
          ) : null}

          {hasSelection ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">
                Selected: <span className="tabular-nums">{selectedCount}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulk.isBusy}
                  onClick={() => setStatusOpen(true)}
                >
                  Update Status
                </Button>
                {canAssignLead ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={bulk.isBusy}
                    onClick={() => {
                      setAssignUserIds(session?.id ? [session.id] : []);
                      setAssignOpen(true);
                    }}
                  >
                    Assign To
                  </Button>
                ) : null}
                {canDeleteLead ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={bulk.isBusy}
                    onClick={() => setDeleteOpen(true)}
                  >
                    Mark as Deleted
                  </Button>
                ) : null}
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
          ) : null}
        </div>

        <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update status</DialogTitle>
              <DialogDescription>
                Apply a new status to {selectedCount} selected lead
                {selectedCount === 1 ? "" : "s"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="bulk-status">Status</Label>
              <select
                id="bulk-status"
                className={selectClass}
                value={status}
                onChange={(event) => setStatus(event.target.value as LeadStatus)}
              >
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleStatusSubmit()}
                disabled={bulk.updateStatus.isPending}
              >
                {bulk.updateStatus.isPending ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign leads</DialogTitle>
              <DialogDescription>
                Assign {selectedCount} selected lead{selectedCount === 1 ? "" : "s"} to one or more
                agents. Multiple agents split leads evenly (round-robin).
              </DialogDescription>
            </DialogHeader>
            <AgentMultiSelect
              id="bulk-assign-agents"
              label="Agents"
              users={users ?? []}
              selectedIds={assignUserIds}
              onChange={setAssignUserIds}
              hint={roundRobinDistributionLabel(assignUserIds, selectedCount)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleAssignSubmit()}
                disabled={assignUserIds.length === 0 || bulk.assign.isPending}
              >
                {bulk.assign.isPending ? "Assigning..." : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive leads</DialogTitle>
              <DialogDescription>
                Soft-delete {selectedCount} selected lead{selectedCount === 1 ? "" : "s"}? They can
                be viewed under the Deleted scope.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteSubmit()}
                disabled={bulk.archive.isPending}
              >
                {bulk.archive.isPending ? "Archiving..." : "Mark as Deleted"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
