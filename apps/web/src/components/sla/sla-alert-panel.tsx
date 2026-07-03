"use client";

import { SlaSummaryCards } from "@/components/sla/sla-summary-cards";
import { useSlaSummary } from "@/hooks/use-sla";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function SlaAlertPanel() {
  const summary = useSlaSummary();
  const breachCount = summary.data?.inactive_3d ?? 0;

  return (
    <Card className="border-orange-200/80 dark:border-orange-500/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          SLA breaches
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sla">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{breachCount}</span> active
          leads inactive for 3+ days.
        </p>
        <SlaSummaryCards summary={summary.data} isLoading={summary.isLoading} />
      </CardContent>
    </Card>
  );
}
