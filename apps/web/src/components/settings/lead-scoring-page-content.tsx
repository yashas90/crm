"use client";

import { LeadScoreBadge } from "@/components/leads/lead-score-badge";
import {
  HOT_LEAD_SCORE_THRESHOLD,
  WARM_LEAD_SCORE_THRESHOLD,
  useLeadScoringConfig,
  useLeadScoringStats,
  useRecalculateLeadScores,
} from "@/hooks/use-lead-scoring";
import { formatScoreFactor } from "@/lib/lead-score-display";
import { DEFAULT_LEAD_SCORING_RULES } from "@/lib/lead-scoring-rules";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

function StatTile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function LeadScoringPageContent() {
  const config = useLeadScoringConfig();
  const stats = useLeadScoringStats();
  const recalculate = useRecalculateLeadScores();

  const rules = config.data?.rules ?? DEFAULT_LEAD_SCORING_RULES;
  const ruleLabels = config.data?.ruleLabels ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Scoring</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Rule-based scores (0–100) help agents prioritize outreach. Scores recalculate every 6
            hours and after calls, notes, visits, and lead updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">Back to settings</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={recalculate.isPending}
            onClick={() => void recalculate.mutate()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", recalculate.isPending && "animate-spin")} />
            Recalculate all
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active leads scored"
          value={stats.isLoading ? "—" : (stats.data?.totalScored ?? 0)}
        />
        <StatTile
          label="Hot"
          value={stats.isLoading ? "—" : (stats.data?.hot ?? 0)}
          sub={`Score ≥ ${HOT_LEAD_SCORE_THRESHOLD}`}
        />
        <StatTile
          label="Warm"
          value={stats.isLoading ? "—" : (stats.data?.warm ?? 0)}
          sub={`${WARM_LEAD_SCORE_THRESHOLD}–${HOT_LEAD_SCORE_THRESHOLD - 1}`}
        />
        <StatTile
          label="Cold"
          value={stats.isLoading ? "—" : (stats.data?.cold ?? 0)}
          sub={`< ${WARM_LEAD_SCORE_THRESHOLD}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tier examples</CardTitle>
          <CardDescription>
            Lead temperature syncs automatically from score when scoring is on.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <LeadScoreBadge score={85} showPoints />
          <LeadScoreBadge score={55} showPoints />
          <LeadScoreBadge score={20} showPoints />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring rules</CardTitle>
          <CardDescription>
            {config.data?.enabled === false
              ? "Scoring is disabled in organization settings."
              : "Points stack from engagement signals, freshness, and penalties."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 rounded-lg border border-slate-200/80 bg-muted/10 p-3 text-sm dark:border-white/10">
            {(ruleLabels.length > 0
              ? ruleLabels.map((entry) => ({
                  label: entry.label,
                  points: rules[entry.key as keyof typeof rules] ?? 0,
                }))
              : Object.entries(DEFAULT_LEAD_SCORING_RULES).map(([key, points]) => ({
                  label: key,
                  points,
                }))
            ).map((rule) => (
              <li key={rule.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{rule.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatScoreFactor(rule.points)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
