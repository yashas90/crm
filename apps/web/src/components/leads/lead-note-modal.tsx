"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadRow } from "@/hooks/use-leads";
import { useAddLeadNote } from "@/hooks/use-leads";
import { Button } from "@propninja/ui/button";
import { useState } from "react";

type LeadNoteModalProps = {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeadNoteModal({ lead, open, onOpenChange }: LeadNoteModalProps) {
  const [text, setText] = useState("");
  const addNote = useAddLeadNote(lead?.id ?? "");

  function handleOpenChange(next: boolean) {
    if (!next) {
      setText("");
    }
    onOpenChange(next);
  }

  function handleSave() {
    if (!lead || !text.trim()) return;
    addNote.mutate(text.trim(), {
      onSuccess: () => {
        setText("");
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>
            {lead
              ? `Internal note for ${lead.firstName} ${lead.lastName}`.trim()
              : "Add an internal note for this lead."}
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Write a note..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!text.trim() || addNote.isPending}>
            {addNote.isPending ? "Saving..." : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
