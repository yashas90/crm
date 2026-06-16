"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkTaskActions } from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@propninja/ui/button";
import { Label } from "@propninja/ui/label";
import { CheckCircle2, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

const selectClass =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type TasksBulkActionsBarProps = {
  selectedIds: string[];
  onClearSelection: () => void;
  canManage: boolean;
};

export function TasksBulkActionsBar({
  selectedIds,
  onClearSelection,
  canManage,
}: TasksBulkActionsBarProps) {
  const bulk = useBulkTaskActions();
  const { data: users } = useUsers();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");

  if (selectedIds.length === 0) return null;

  async function handleComplete() {
    const result = await bulk.complete.mutateAsync(selectedIds);
    if (result.succeeded.length > 0) onClearSelection();
  }

  async function handleReassign() {
    if (!assignUserId) return;
    const result = await bulk.reassign.mutateAsync({
      taskIds: selectedIds,
      assignedTo: assignUserId,
    });
    setReassignOpen(false);
    setAssignUserId("");
    if (result.succeeded.length > 0) onClearSelection();
  }

  async function handleDelete() {
    const result = await bulk.delete.mutateAsync(selectedIds);
    setDeleteOpen(false);
    if (result.succeeded.length > 0) onClearSelection();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <span className="text-sm font-medium">{selectedIds.length} selected</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleComplete()}
          disabled={bulk.complete.isPending}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Mark complete
        </Button>
        {canManage ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Reassign
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          Clear
        </Button>
      </div>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign tasks</DialogTitle>
            <DialogDescription>Assign {selectedIds.length} task(s) to an agent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-assignee">Agent</Label>
            <select
              id="bulk-assignee"
              className={selectClass}
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Select agent</option>
              {(users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleReassign()}
              disabled={!assignUserId || bulk.reassign.isPending}
            >
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tasks</DialogTitle>
            <DialogDescription>
              Permanently delete {selectedIds.length} task(s)? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={bulk.delete.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
