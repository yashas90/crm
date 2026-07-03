"use client";

import { formatRelativeTime } from "@/lib/relative-time";
import { computeLeadSlaState } from "@/lib/sla";
import { cn } from "@propninja/ui/lib/utils";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type LeadSlaBadgeProps = {
  lead: {
    leadStatus: string;
    lastActivityAt?: string | null;
    lastContactedAt?: string | null;
    createdAt?: string | null;
    slaBreachedAt?: string | null;
  };
  className?: string;
  showDetail?: boolean;
};

const SEVERITY_STYLES = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  breach:
    "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200",
  critical:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  na: "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400",
};

const SEVERITY_ICONS = {
  ok: CheckCircle2,
  warning: Clock,
  breach: AlertTriangle,
  critical: AlertTriangle,
  na: Clock,
};

export function LeadSlaBadge({ lead, className, showDetail = false }: LeadSlaBadgeProps) {
  const state = computeLeadSlaState(lead);
  const Icon = SEVERITY_ICONS[state.severity];

  if (!state.applies && !showDetail) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        SEVERITY_STYLES[state.severity],
        className,
      )}
      title={
        state.lastEngagementAt
          ? `Last engagement ${formatRelativeTime(state.lastEngagementAt)}`
          : undefined
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{state.label}</span>
    </div>
  );
}

export function LeadSlaPanel({
  lead,
}: {
  lead: {
    leadStatus: string;
    lastActivityAt?: string | null;
    lastContactedAt?: string | null;
    createdAt?: string | null;
    slaBreachedAt?: string | null;
  };
}) {
  const state = computeLeadSlaState(lead);

  if (!state.applies) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground dark:border-white/10">
        SLA tracking applies to active pipeline stages only (new → negotiation).
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-muted/20 px-4 py-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">SLA status</p>
        <LeadSlaBadge lead={lead} showDetail />
      </div>
      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Last engagement</dt>
          <dd>{formatRelativeTime(state.lastEngagementAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Days inactive</dt>
          <dd className="tabular-nums">{state.daysSinceActivity}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Breach threshold</dt>
          <dd className="tabular-nums">{state.thresholdDays} days</dd>
        </div>
        {lead.slaBreachedAt ? (
          <div>
            <dt className="font-medium text-foreground">Flagged at</dt>
            <dd>{formatRelativeTime(lead.slaBreachedAt)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
