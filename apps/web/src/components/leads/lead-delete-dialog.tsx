"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteLead } from "@/hooks/use-leads";
import { Button } from "@propninja/ui/button";
import { useRouter } from "next/navigation";

type LeadDeleteDialogProps = {
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, navigate to /leads after a successful delete (detail page). */
  redirectOnSuccess?: boolean;
};

export function LeadDeleteDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
  redirectOnSuccess = false,
}: LeadDeleteDialogProps) {
  const router = useRouter();
  const deleteLead = useDeleteLead();

  function confirmDelete() {
    deleteLead.mutate(leadId, {
      onSuccess: () => {
        onOpenChange(false);
        if (redirectOnSuccess) {
          router.push("/leads");
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete lead?</DialogTitle>
          <DialogDescription>
            This will archive {leadName} (soft delete). Admin permissions are required.
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
            disabled={deleteLead.isPending}
          >
            {deleteLead.isPending ? "Deleting..." : "Delete lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
