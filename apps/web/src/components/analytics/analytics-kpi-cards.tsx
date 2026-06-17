"use client";

import type { AnalyticsKpi } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type KpiCardProps = {
  title: string;
  kpi: AnalyticsKpi;
  formatValue?: (value: number) => string;
  suffix?: string;
  onClick?: () => void;
};

function formatChange(changePercent: number | null) {
  if (changePercent === null) return { label: "—", trend: "flat" as const };
  if (changePercent > 0) return { label: `+${changePercent}%`, trend: "up" as const };
  if (changePercent < 0) return { label: `${changePercent}%`, trend: "down" as const };
  return { label: "0%", trend: "flat" as const };
}

function KpiCard({ title, kpi, formatValue, suffix, onClick }: KpiCardProps) {
  const rawValue = Number.isFinite(kpi.value) ? kpi.value : 0;
  const display = formatValue ? formatValue(rawValue) : String(rawValue);
  const change = formatChange(kpi.changePercent);

  return (
    <Card
      className={cn(
        "border-border/60 shadow-sm",
        onClick && "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30",
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">
          {display}
          {suffix ? (
            <span className="text-lg font-semibold text-muted-foreground">{suffix}</span>
          ) : null}
        </p>
        <div
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            change.trend === "up" && "text-emerald-600",
            change.trend === "down" && "text-red-600",
            change.trend === "flat" && "text-muted-foreground",
          )}
        >
          {change.trend === "up" ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : change.trend === "down" ? (
            <ArrowDownRight className="h-3.5 w-3.5" />
          ) : (
            <Minus className="h-3.5 w-3.5" />
          )}
          <span>{change.label} vs previous period</span>
        </div>
      </CardContent>
    </Card>
  );
}

export type AnalyticsOverviewKpis = {
  totalLeads: AnalyticsKpi;
  leadsContacted: AnalyticsKpi;
  siteVisitsScheduled: AnalyticsKpi;
  siteVisitsCompleted: AnalyticsKpi;
  leadsWon: AnalyticsKpi;
  conversionRate: AnalyticsKpi;
  totalCalls: AnalyticsKpi;
  avgResponseTimeHours: AnalyticsKpi;
  bookingsThisMonth: AnalyticsKpi;
};

type AnalyticsKpiCardsProps = {
  kpis: AnalyticsOverviewKpis;
  onBookingsClick?: () => void;
};

export function AnalyticsKpiCards({ kpis, onBookingsClick }: AnalyticsKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Total Leads" kpi={kpis.totalLeads} />
      <KpiCard title="Leads Contacted" kpi={kpis.leadsContacted} />
      <KpiCard title="Site Visits Scheduled" kpi={kpis.siteVisitsScheduled} />
      <KpiCard title="Site Visits Completed" kpi={kpis.siteVisitsCompleted} />
      <KpiCard
        title="Total Bookings This Month"
        kpi={kpis.bookingsThisMonth}
        onClick={onBookingsClick}
      />
      <KpiCard title="Leads Won" kpi={kpis.leadsWon} />
      <KpiCard title="Conversion Rate" kpi={kpis.conversionRate} suffix="%" />
      <KpiCard title="Total Calls Made" kpi={kpis.totalCalls} />
      <KpiCard
        title="Avg Response Time"
        kpi={kpis.avgResponseTimeHours}
        formatValue={(v) => (Number.isFinite(v) ? v.toFixed(1) : "0")}
        suffix="h"
      />
    </div>
  );
}
