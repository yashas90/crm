"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteProject } from "@/hooks/use-projects";
import { Button } from "@propninja/ui/button";

type ProjectDeleteDialogProps = {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function ProjectDeleteDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onDeleted,
}: ProjectDeleteDialogProps) {
  const deleteProject = useDeleteProject();

  function confirmDelete() {
    deleteProject.mutate(projectId, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            This will archive {projectName}. You can view it later under the Deleted tab.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmDelete}
            disabled={deleteProject.isPending}
          >
            {deleteProject.isPending ? "Deleting..." : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
