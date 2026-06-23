"use client";

import { useTodaySiteVisits } from "@/hooks/use-site-visits";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { CalendarClock } from "lucide-react";
import Link from "next/link";

export function TodaySiteVisitsWidget() {
  const { data, isLoading } = useTodaySiteVisits();
  const count = data?.total ?? data?.items.length ?? 0;

  return (
    <Link href="/site-visits?date=today">
      <Card className="transition hover:border-primary/40 hover:shadow-[2px_2px_0_0_#000]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today&apos;s site visits</CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "…" : count}</div>
          <p className="text-xs text-muted-foreground">Across all agents</p>
        </CardContent>
      </Card>
    </Link>
  );
}
