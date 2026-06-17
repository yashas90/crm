"use client";

import { useLeadFollowUpHistory, useUpdateLeadFollowUp } from "@/hooks/use-follow-ups";
import { formatRelativeTime } from "@/lib/relative-time";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useState } from "react";

type LeadFollowUpPanelProps = {
  leadId: string;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
  followUpCount?: number;
};

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadFollowUpPanel({
  leadId,
  lastContactedAt,
  nextFollowupAt,
  followUpCount = 0,
}: LeadFollowUpPanelProps) {
  const updateFollowUp = useUpdateLeadFollowUp(leadId);
  const { data: history } = useLeadFollowUpHistory(leadId);
  const [nextAt, setNextAt] = useState(toDatetimeLocal(nextFollowupAt));

  async function saveFollowUp(markComplete: boolean) {
    if (!nextAt) return;
    await updateFollowUp.mutateAsync({
      nextFollowupAt: new Date(nextAt).toISOString(),
      markComplete,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">Follow-up</h3>
        <p className="text-xs text-muted-foreground">
          {followUpCount} completed follow-up{followUpCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Last contacted</p>
          <p className="text-sm">
            {lastContactedAt ? formatRelativeTime(lastContactedAt) : "Never"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Next follow-up</p>
          <p className="text-sm">
            {nextFollowupAt
              ? new Date(nextFollowupAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Not set"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="next-followup">Schedule next follow-up</Label>
        <Input
          id="next-followup"
          type="datetime-local"
          value={nextAt}
          onChange={(e) => setNextAt(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void saveFollowUp(false)}
            disabled={!nextAt}
          >
            Save
          </Button>
          <Button size="sm" onClick={() => void saveFollowUp(true)} disabled={!nextAt}>
            Mark done + set next
          </Button>
        </div>
      </div>

      {history && history.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Follow-up history</p>
          <ul className="space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.id} className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="font-medium">
                  {new Date(item.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.userName ?? "Agent"}
                  {typeof item.metadata?.nextFollowupAt === "string"
                    ? ` · Next: ${new Date(item.metadata.nextFollowupAt).toLocaleDateString("en-IN")}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
