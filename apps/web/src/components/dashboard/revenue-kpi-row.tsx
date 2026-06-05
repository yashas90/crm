"use client";

import { Card, CardContent } from "@propninja/ui/card";
import { IndianRupee, TrendingUp } from "lucide-react";

type RevenueKpiRowProps = {
  revenue: {
    won_value_month: number;
    avg_deal_size: number;
  };
};

export function RevenueKpiRow({ revenue }: RevenueKpiRowProps) {
  const items = [
    {
      title: "Won value (month)",
      value: `₹${revenue.won_value_month.toLocaleString("en-IN")}`,
      hint: "Estimated value of deals won this month",
      icon: IndianRupee,
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Avg deal size",
      value: revenue.avg_deal_size > 0 ? `₹${revenue.avg_deal_size.toLocaleString("en-IN")}` : "—",
      hint: "Across all won leads with a value",
      icon: TrendingUp,
      iconBg: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="border-border/60 shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.iconBg}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
