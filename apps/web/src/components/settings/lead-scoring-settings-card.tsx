"use client";

import { ApiRequestError, apiPatch } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const SCORING_RULES: { label: string; points: number }[] = [
  { label: "Called and answered at least once", points: 20 },
  { label: "Replied to WhatsApp", points: 15 },
  { label: "Site visit scheduled", points: 10 },
  { label: "Site visit completed", points: 20 },
  { label: "Note added in last 3 days", points: 5 },
  { label: "Re-enquired after lost", points: 10 },
  { label: "Lead created in last 24 hours", points: 15 },
  { label: "Created 1–3 days ago", points: 10 },
  { label: "Created 4–7 days ago", points: 5 },
  { label: "No contact in 5+ days", points: -10 },
  { label: "No contact in 10+ days", points: -20 },
  { label: "Marked Do Not Call (TCF)", points: -15 },
  { label: "No answer 3+ times in a row", points: -10 },
  { label: "Source: Meta Ads or Google Ads", points: 10 },
  { label: "Source: Referral", points: 5 },
];

type OrgRecord = {
  settings: Record<string, unknown>;
};

type LeadScoringSettingsCardProps = {
  org?: OrgRecord;
  canUpdate: boolean;
  queryClient: QueryClient;
};

function readScoringEnabled(settings: Record<string, unknown>): boolean {
  const value = settings.leadScoringEnabled;
  return value === true || value === "true";
}

export function LeadScoringSettingsCard({
  org,
  canUpdate,
  queryClient,
}: LeadScoringSettingsCardProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!org) return;
    setEnabled(readScoringEnabled(org.settings ?? {}));
  }, [org]);

  const saveScoring = useMutation({
    mutationFn: (leadScoringEnabled: boolean) =>
      apiPatch("/api/org", { settings: { leadScoringEnabled } }),
    onSuccess: (data) => {
      queryClient.setQueryData(["org"], data);
      toast.success("Lead scoring settings saved.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Failed to update lead scoring.";
      toast.error(message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lead Scoring</CardTitle>
        <CardDescription>
          Rule-based priority scores help agents focus on the hottest leads first. Point values are
          read-only in this release.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-muted/20 px-3 py-3 text-sm dark:border-white/10">
          <div>
            <Label htmlFor="lead-scoring-enabled" className="font-medium">
              Enable lead scoring
            </Label>
            <p className="text-xs text-muted-foreground">
              Scores recalculate every 6 hours for active leads.
            </p>
          </div>
          <input
            id="lead-scoring-enabled"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={enabled}
            disabled={!canUpdate || saveScoring.isPending}
            onChange={(event) => {
              const next = event.target.checked;
              setEnabled(next);
              if (canUpdate) saveScoring.mutate(next);
            }}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">Scoring rules</p>
          <ul className="space-y-1 rounded-lg border border-slate-200/80 bg-muted/10 p-3 text-sm dark:border-white/10">
            {SCORING_RULES.map((rule) => (
              <li key={rule.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{rule.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {rule.points > 0 ? `+${rule.points}` : rule.points}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {canUpdate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveScoring.isPending}
            onClick={() => saveScoring.mutate(enabled)}
          >
            {saveScoring.isPending ? "Saving..." : "Save scoring toggle"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
