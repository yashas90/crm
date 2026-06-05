"use client";

import { useUpdateLead } from "@/hooks/use-leads";
import type { LeadDetail } from "@/hooks/use-leads";
import { formatInrFull } from "@/lib/format-currency";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Pencil } from "lucide-react";
import { useState } from "react";

type InlineEstimatedValueProps = {
  lead: LeadDetail;
};

export function InlineEstimatedValue({ lead }: InlineEstimatedValueProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lead.estimatedValue ?? "");
  const updateLead = useUpdateLead(lead.id);

  function save() {
    const num = value ? Number(value) : 0;
    updateLead.mutate(
      { estimatedValue: value ? num : null },
      {
        onSuccess: () => {
          toast.success("Estimated value updated");
          setEditing(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update");
        },
      },
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          className="h-8 w-36 rounded-lg"
          placeholder="Amount in ₹"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button size="sm" onClick={save} disabled={updateLead.isPending}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium">
        {lead.estimatedValue ? formatInrFull(Number(lead.estimatedValue)) : "Not set"}
      </span>
      <button
        type="button"
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => {
          setValue(lead.estimatedValue ?? "");
          setEditing(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
