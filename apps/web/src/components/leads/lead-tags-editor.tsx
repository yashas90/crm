"use client";

import { type LeadDetail, useUpdateLead } from "@/hooks/use-leads";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Pencil } from "lucide-react";
import { useState } from "react";

type LeadTagsEditorProps = {
  lead: LeadDetail;
};

export function LeadTagsEditor({ lead }: LeadTagsEditorProps) {
  const [editing, setEditing] = useState(false);
  const [tagsText, setTagsText] = useState((lead.tags ?? []).join(", "));
  const updateLead = useUpdateLead(lead.id);

  function save() {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateLead.mutate(
      { tags },
      {
        onSuccess: () => {
          toast.success("Tags updated");
          setEditing(false);
        },
      },
    );
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <Input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="vip, 2bhk, metro"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={updateLead.isPending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2">
      {lead.tags?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {lead.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">No tags</span>
      )}
      <button
        type="button"
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => {
          setTagsText((lead.tags ?? []).join(", "));
          setEditing(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
