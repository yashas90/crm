"use client";

import type { OverviewLeadStrip } from "@/hooks/use-reports";
import { drillDownRoutes } from "@/lib/drill-down-routes";
import { Card, CardContent } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useRouter } from "next/navigation";
import { memo } from "react";

type KpiItem = {
  label: string;
  value: number;
  accent: string;
  pill: string;
  href?: string;
};

function buildItems(strip: OverviewLeadStrip): KpiItem[] {
  return [
    {
      label: "Total Leads",
      value: strip.total_leads,
      accent: "border-l-sky-400",
      pill: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
      href: drillDownRoutes.totalLeads(),
    },
    {
      label: "Active",
      value: strip.active_leads,
      accent: "border-l-emerald-400",
      pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
      href: drillDownRoutes.activeLeads(),
    },
    {
      label: "Unassigned",
      value: strip.unassigned_leads,
      accent: "border-l-amber-400",
      pill: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
      href: drillDownRoutes.unassignedLeads(),
    },
    {
      label: "Deleted",
      value: strip.deleted_leads,
      accent: "border-l-slate-400",
      pill: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    },
    {
      label: "Booked",
      value: strip.booked_count,
      accent: "border-l-emerald-400",
      pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
      href: drillDownRoutes.leadsByStatus("won"),
    },
    {
      label: "Not Interested",
      value: strip.not_interested_count,
      accent: "border-l-rose-400",
      pill: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
    },
    {
      label: "Dropped (30d)",
      value: strip.dropped_count,
      accent: "border-l-orange-400",
      pill: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
    },
    {
      label: "Today New",
      value: strip.today_new_leads,
      accent: "border-l-violet-400",
      pill: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
    },
    {
      label: "Today Calls",
      value: strip.today_calls,
      accent: "border-l-teal-400",
      pill: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
      href: drillDownRoutes.todayCalls(),
    },
    {
      label: "Callbacks",
      value: strip.pending_callbacks_count,
      accent: "border-l-indigo-400",
      pill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
    },
    {
      label: "Meetings",
      value: strip.today_meetings_count,
      accent: "border-l-purple-400",
      pill: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
    },
  ];
}

type OverviewKpiStripProps = {
  strip: OverviewLeadStrip;
};

export const OverviewKpiStrip = memo(function OverviewKpiStrip({ strip }: OverviewKpiStripProps) {
  const router = useRouter();
  const items = buildItems(strip);

  return (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-1 scrollbar-thin",
        "md:grid md:grid-cols-5 md:overflow-visible lg:grid-cols-5 xl:grid-cols-10",
      )}
    >
      {items.map((item) => (
        <Card
          key={item.label}
          className={cn(
            "min-w-[9.5rem] shrink-0 border-border/60 border-l-4 shadow-sm",
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
            item.accent,
            item.href && "cursor-pointer hover:border-primary/40",
          )}
          role={item.href ? "link" : undefined}
          tabIndex={item.href ? 0 : undefined}
          onClick={item.href ? () => router.push(item.href!) : undefined}
          onKeyDown={
            item.href
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(item.href!);
                  }
                }
              : undefined
          }
        >
          <CardContent className="p-4">
            <span
              className={cn(
                "mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                item.pill,
              )}
            >
              {item.label}
            </span>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
