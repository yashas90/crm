"use client";

import { LeadEditForm } from "@/components/leads/lead-edit-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadRow } from "@/hooks/use-leads";

type LeadEditModalProps = {
  lead: (LeadRow & { city?: string | null; state?: string | null; notes?: string | null }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeadEditModal({ lead, open, onOpenChange }: LeadEditModalProps) {
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit {lead.firstName} {lead.lastName}
          </DialogTitle>
          <DialogDescription>Update basic lead fields. No calling from web.</DialogDescription>
        </DialogHeader>
        <LeadEditForm lead={lead} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
