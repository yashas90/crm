"use client";

import { InrInput } from "@/components/common/inr-input";
import { useFormatMoney } from "@/hooks/use-format-money";
import { type LeadDetail, useUpdateLead } from "@/hooks/use-leads";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Pencil } from "lucide-react";
import { useState } from "react";

type InlineEstimatedValueProps = {
  lead: LeadDetail;
};

export function InlineEstimatedValue({ lead }: InlineEstimatedValueProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | null>(
    lead.estimatedValue ? Number(lead.estimatedValue) : null,
  );
  const updateLead = useUpdateLead(lead.id);
  const { formatMoney } = useFormatMoney();

  function save() {
    const num = value ?? 0;
    updateLead.mutate(
      { estimatedValue: value ? num : null },
      {
        onSuccess: () => {
          toast.success("Estimated value updated");
          setEditing(false);
        },
      },
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <InrInput className="w-40" value={value} onChange={setValue} />
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
        {lead.estimatedValue ? formatMoney(Number(lead.estimatedValue)) : "Not set"}
      </span>
      <button
        type="button"
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => {
          setValue(lead.estimatedValue ? Number(lead.estimatedValue) : null);
          setEditing(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
