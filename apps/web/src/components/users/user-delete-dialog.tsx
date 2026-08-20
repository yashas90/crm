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
import { useLeads } from "@/hooks/use-leads";
import { type UserRow, useDeleteUser, useUsers } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { formatUserFullName } from "@/lib/user-display";
import { Button } from "@propninja/ui/button";
import { useEffect, useMemo, useState } from "react";

type UserDeleteDialogProps = {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserDeleteDialog({ user, open, onOpenChange }: UserDeleteDialogProps) {
  const deleteUser = useDeleteUser();
  const agentsQuery = useUsers(undefined, { enabled: open });
  const leadsQuery = useLeads(
    {
      assignedTo: user?.id,
      page: "1",
      pageSize: "1",
    },
    { enabled: open && Boolean(user?.id) },
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const leadCount = leadsQuery.data?.total ?? 0;
  const leadsLoading = !leadsQuery.data && (leadsQuery.isLoading || leadsQuery.isFetching);

  const assigneeOptions = useMemo(() => {
    const items = agentsQuery.data ?? [];
    return items.filter((row) => row.isActive && row.id !== user?.id);
  }, [agentsQuery.data, user?.id]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setError(null);
  }, [open, user?.id]);

  const fullName = user ? formatUserFullName(user) : "this user";
  const requiresReassign = leadCount > 0;
  const canSubmit =
    Boolean(user) &&
    !deleteUser.isPending &&
    !leadsLoading &&
    (!requiresReassign || selectedIds.length > 0);

  function handleConfirm() {
    if (!user) return;
    setError(null);

    if (requiresReassign && selectedIds.length === 0) {
      setError("Select at least one agent to receive this user's leads.");
      return;
    }

    deleteUser.mutate(
      {
        userId: user.id,
        reassignToUserIds: selectedIds,
        userName: fullName,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(getErrorMessage(err, "Failed to delete user")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {fullName}?</DialogTitle>
          <DialogDescription>
            This deactivates the account and signs them out. Their assigned leads will be moved to
            the agents you select (split evenly if you pick more than one).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            {leadsLoading
              ? "Checking assigned leads…"
              : leadCount === 0
                ? "This user has no assigned leads."
                : `This user has ${leadCount} assigned lead${leadCount === 1 ? "" : "s"} that must be reassigned.`}
          </p>

          <AgentMultiSelect
            id="delete-user-reassign-agents"
            label="Reassign leads to"
            users={assigneeOptions}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            isLoading={agentsQuery.isLoading}
            errorMessage={
              agentsQuery.isError
                ? getErrorMessage(agentsQuery.error, "Failed to load agents")
                : undefined
            }
            onRetry={() => void agentsQuery.refetch()}
            hint={
              leadCount > 1 && selectedIds.length > 1
                ? "Leads are distributed round-robin across selected agents."
                : undefined
            }
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!canSubmit} onClick={handleConfirm}>
            {deleteUser.isPending ? "Deleting…" : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
