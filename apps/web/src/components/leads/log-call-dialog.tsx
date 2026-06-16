"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadDetail } from "@/hooks/use-leads";
import { useLogCall } from "@/hooks/use-leads";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, type CallOutcome } from "@propninja/types/enums";
import { Button } from "@propninja/ui/button";
import { useEffect, useState } from "react";

type LogCallDialogProps = {
  lead: Pick<LeadDetail, "id" | "firstName" | "phone">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged?: () => void;
};

export function LogCallDialog({ lead, open, onOpenChange, onLogged }: LogCallDialogProps) {
  const logCall = useLogCall();
  const [durationMinutes, setDurationMinutes] = useState("5");
  const [outcome, setOutcome] = useState<CallOutcome>("answered");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDurationMinutes("5");
    setOutcome("answered");
    setNotes("");
  }, [open]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!lead.phone) {
      toast.error("This lead has no phone number.");
      return;
    }

    const duration = Number.parseFloat(durationMinutes);
    if (Number.isNaN(duration) || duration <= 0) {
      toast.error("Enter a valid call duration in minutes.");
      return;
    }

    logCall.mutate(
      {
        lead_id: lead.id,
        phone_number: lead.phone,
        duration,
        outcome,
        notes: notes.trim() || undefined,
        source: "web-manual",
      },
      {
        onSuccess: () => {
          toast.success("Call logged");
          onOpenChange(false);
          onLogged?.();
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, "Failed to log call"));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>
            Record a manual call with {lead.firstName}. Outbound calls from the web are logged for
            the timeline only.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="call-duration" className="text-sm font-medium">
              Duration (minutes)
            </label>
            <input
              id="call-duration"
              type="number"
              min="1"
              step="1"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="call-outcome" className="text-sm font-medium">
              Outcome
            </label>
            <select
              id="call-outcome"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as CallOutcome)}
            >
              {CALL_OUTCOMES.map((value) => (
                <option key={value} value={value}>
                  {CALL_OUTCOME_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="call-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="call-notes"
              className="min-h-[96px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional notes about the conversation..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={logCall.isPending}>
              {logCall.isPending ? "Saving..." : "Save call"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
