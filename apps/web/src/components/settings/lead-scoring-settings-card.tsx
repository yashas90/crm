"use client";

import { useRecalculateLeadScores } from "@/hooks/use-lead-scoring";
import { ApiRequestError, apiPatch } from "@/lib/apiClient";
import { formatScoreFactor } from "@/lib/lead-score-display";
import { DEFAULT_LEAD_SCORING_RULES, LEAD_SCORING_RULE_LABELS } from "@/lib/lead-scoring-rules";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  if (value === false || value === "false") return false;
  return true;
}

export function LeadScoringSettingsCard({
  org,
  canUpdate,
  queryClient,
}: LeadScoringSettingsCardProps) {
  const [enabled, setEnabled] = useState(true);
  const recalculate = useRecalculateLeadScores();

  useEffect(() => {
    if (!org) return;
    setEnabled(readScoringEnabled(org.settings ?? {}));
  }, [org]);

  const saveScoring = useMutation({
    mutationFn: (leadScoringEnabled: boolean) =>
      apiPatch("/api/org", { settings: { leadScoringEnabled } }),
    onSuccess: async (data, leadScoringEnabled) => {
      queryClient.setQueryData(["org"], data);
      toast.success("Lead scoring settings saved.");
      if (leadScoringEnabled) {
        const result = await recalculate.mutateAsync();
        if (!result.skipped && result.updated > 0) {
          toast.success(`Recalculated scores for ${result.updated} lead(s).`);
        }
      }
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError ? error.message : "Failed to update lead scoring.";
      toast.error(message);
      if (org) setEnabled(readScoringEnabled(org.settings ?? {}));
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Lead Scoring</CardTitle>
          <CardDescription>
            Rule-based priority scores (0–100). Hot ≥ 70, warm ≥ 40. Recalculates every 6 hours and
            after engagement events.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/lead-scoring">View details</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-muted/20 px-3 py-3 text-sm dark:border-white/10">
          <div>
            <Label htmlFor="lead-scoring-enabled" className="font-medium">
              Enable lead scoring
            </Label>
            <p className="text-xs text-muted-foreground">
              On by default. Disabling stops recalculation and hot-lead score filters.
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
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200/80 bg-muted/10 p-3 text-sm dark:border-white/10">
            {LEAD_SCORING_RULE_LABELS.map((entry) => (
              <li key={entry.key} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatScoreFactor(DEFAULT_LEAD_SCORING_RULES[entry.key])}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {canUpdate ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={recalculate.isPending || !enabled}
              onClick={() => void recalculate.mutate()}
            >
              {recalculate.isPending ? "Recalculating..." : "Recalculate now"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
