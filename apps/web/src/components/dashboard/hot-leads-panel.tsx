"use client";

import { LeadScoreBadge } from "@/components/leads/lead-score-badge";
import { useHotLeads } from "@/hooks/use-hot-leads";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Flame } from "lucide-react";
import Link from "next/link";

export function HotLeadsPanel() {
  const hotLeads = useHotLeads(8);

  return (
    <Card className="border-orange-200/80 dark:border-orange-500/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Flame className="h-4 w-4 text-orange-600" />
          Hot leads (score)
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leads">All leads</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {hotLeads.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading hot leads…</p>
        ) : (hotLeads.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No score-based hot leads right now.</p>
        ) : (
          <ul className="space-y-2">
            {hotLeads.data!.items.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm transition-colors hover:bg-muted/40 dark:border-white/10"
                >
                  <span className="truncate font-medium">
                    {`${lead.firstName} ${lead.lastName}`.trim()}
                  </span>
                  {typeof lead.score === "number" ? (
                    <LeadScoreBadge score={lead.score} showPoints />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
