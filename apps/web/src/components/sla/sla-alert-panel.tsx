"use client";

import { useSlaSummary } from "@/hooks/use-sla";
import { SLA_THRESHOLD_DAYS, SLA_THRESHOLD_LABELS, type SlaSummary } from "@/lib/sla";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Skeleton } from "@propninja/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

function CompactSlaRows({
  summary,
  isLoading,
}: {
  summary?: SlaSummary;
  isLoading?: boolean;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {SLA_THRESHOLD_DAYS.map((days) => {
        const count = summary?.[`inactive_${days}d` as keyof SlaSummary] ?? 0;
        const label = SLA_THRESHOLD_LABELS[days] ?? `${days}d inactive`;
        const isDefault = days === 3;

        return (
          <li
            key={days}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2.5",
              isDefault && "bg-orange-500/5 dark:bg-orange-500/10",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{label}</p>
              {isDefault ? (
                <p className="text-xs text-muted-foreground">Default SLA threshold</p>
              ) : null}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-12 shrink-0" />
            ) : (
              <span
                className={cn(
                  "shrink-0 text-xl font-bold tabular-nums tracking-tight",
                  Number(count) > 0 ? "text-orange-700 dark:text-orange-300" : "text-foreground",
                )}
              >
                {Number(count).toLocaleString()}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SlaAlertPanel() {
  const summary = useSlaSummary();
  const breachCount = summary.data?.inactive_3d ?? 0;

  return (
    <Card className="overflow-hidden border-orange-200/80 dark:border-orange-500/30">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
          SLA breaches
        </CardTitle>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href="/sla">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {summary.isLoading ? "—" : breachCount.toLocaleString()}
          </span>{" "}
          active leads inactive for 3+ days.
        </p>
        <CompactSlaRows summary={summary.data} isLoading={summary.isLoading} />
      </CardContent>
    </Card>
  );
}
