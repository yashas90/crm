"use client";

import { Card, CardContent } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Flame,
  Phone,
  Trophy,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TodayKpi = {
  title: string;
  value: string | number;
  trend?: number;
  hint: string;
  icon: LucideIcon;
  iconBg: string;
};

type TodayKpiRowProps = {
  kpis: {
    new_leads_today: number;
    new_leads_trend: number;
    calls_today: number;
    calls_trend: number;
    follow_ups_due_today: number;
    deals_won_month: number;
    hot_leads: number;
  };
};

export function TodayKpiRow({ kpis }: TodayKpiRowProps) {
  const items: TodayKpi[] = [
    {
      title: "New Leads",
      value: kpis.new_leads_today,
      trend: kpis.new_leads_trend,
      hint: "Today",
      icon: UserPlus,
      iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      title: "Calls Logged",
      value: kpis.calls_today,
      trend: kpis.calls_trend,
      hint: "From mobile app",
      icon: Phone,
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Hot Leads",
      value: kpis.hot_leads,
      hint: "Marked hot in pipeline",
      icon: Flame,
      iconBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    },
    {
      title: "Follow-ups Due",
      value: kpis.follow_ups_due_today,
      hint: "Due today or overdue",
      icon: CalendarClock,
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      title: "Deals Won",
      value: kpis.deals_won_month,
      hint: "This month",
      icon: Trophy,
      iconBg: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        const positive = item.trend !== undefined && item.trend >= 0;
        return (
          <Card
            key={item.title}
            className="overflow-hidden  transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  item.iconBg,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-3xl font-bold tracking-tight">{item.value}</p>
                  {item.trend !== undefined ? (
                    <span
                      className={cn(
                        "mb-1 flex items-center gap-0.5 text-xs font-semibold",
                        positive ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {positive ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(item.trend)}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
