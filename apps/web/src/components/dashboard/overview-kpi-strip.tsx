"use client";

import type { OverviewLeadStrip } from "@/hooks/use-reports";
import { drillDownRoutes } from "@/lib/drill-down-routes";
import { cn } from "@propninja/ui/lib/utils";
import { useRouter } from "next/navigation";
import { memo } from "react";

const PILL_LABEL =
  "mb-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900";

const KPI_VALUE = "text-3xl font-bold tabular-nums tracking-normal text-slate-900 dark:text-white";

const KPI_CARD =
  "min-w-[9.5rem] shrink-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90";

type KpiItem = {
  label: string;
  value: number;
  accentBg: string;
  href?: string;
};

function buildItems(strip: OverviewLeadStrip): KpiItem[] {
  return [
    {
      label: "Total Leads",
      value: strip.total_leads,
      accentBg: "bg-[#dbeafe]",
      href: drillDownRoutes.totalLeads(),
    },
    {
      label: "Active",
      value: strip.active_leads,
      accentBg: "bg-[#bbf7d0]",
      href: drillDownRoutes.activeLeads(),
    },
    {
      label: "Unassigned",
      value: strip.unassigned_leads,
      accentBg: "bg-[#FEF08A]",
      href: drillDownRoutes.unassignedLeads(),
    },
    {
      label: "Deleted",
      value: strip.deleted_leads,
      accentBg: "bg-neutral-100",
    },
    {
      label: "Booked",
      value: strip.booked_count,
      accentBg: "bg-[#bbf7d0]",
      href: drillDownRoutes.leadsByStatus("won"),
    },
    {
      label: "Not Interested",
      value: strip.not_interested_count,
      accentBg: "bg-[#fecaca]",
    },
    {
      label: "Dropped (30d)",
      value: strip.dropped_count,
      accentBg: "bg-[#fed7aa]",
    },
    {
      label: "Today New",
      value: strip.today_new_leads,
      accentBg: "bg-[#e9d5ff]",
    },
    {
      label: "Today Calls",
      value: strip.today_calls,
      accentBg: "bg-[#bfdbfe]",
      href: drillDownRoutes.todayCalls(),
    },
    {
      label: "Callbacks",
      value: strip.pending_callbacks_count,
      accentBg: "bg-[#c7d2fe]",
    },
    {
      label: "Meetings",
      value: strip.today_meetings_count,
      accentBg: "bg-[#ddd6fe]",
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
        <div
          key={item.label}
          className={cn(
            KPI_CARD,
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:bg-slate-800",
            item.href && "cursor-pointer",
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
          <span className={cn(PILL_LABEL, item.accentBg)}>{item.label}</span>
          <p className={KPI_VALUE}>{item.value}</p>
        </div>
      ))}
    </div>
  );
});
