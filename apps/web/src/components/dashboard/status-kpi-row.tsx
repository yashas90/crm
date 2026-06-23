"use client";

import { drillDownRoutes } from "@/lib/drill-down-routes";
import { Card, CardContent } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useRouter } from "next/navigation";
import { memo } from "react";

export type StatusBreakdownItem = {
  status: string;
  count: number;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Pending",
  qualified: "Qualified",
  negotiation: "Negotiation",
  won: "Booked",
  lost: "Lost",
  not_interested: "Not Interested",
  dropped: "Dropped",
  overdue: "Overdue",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  contacted: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  qualified: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  negotiation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  not_interested: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  dropped: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

function statusHref(status: string): string | undefined {
  if (status === "overdue") return drillDownRoutes.overdueFollowups();
  if (status === "won") return drillDownRoutes.leadsByStatus("won");
  if (status === "lost") return drillDownRoutes.leadsByStatus("lost");
  if (STATUS_LABELS[status]) return drillDownRoutes.leadsByStatus(status);
  return undefined;
}

type StatusKpiRowProps = {
  items: StatusBreakdownItem[];
};

export const StatusKpiRow = memo(function StatusKpiRow({ items }: StatusKpiRowProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {items.map((item) => {
        const label = STATUS_LABELS[item.status] ?? item.status;
        const href = statusHref(item.status);
        const pill = STATUS_STYLES[item.status] ?? "bg-muted text-foreground";

        return (
          <Card
            key={item.status}
            className={cn(
              " transition-all duration-200",
              href &&
                "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
            )}
            role={href ? "link" : undefined}
            tabIndex={href ? 0 : undefined}
            onClick={href ? () => router.push(href) : undefined}
            onKeyDown={
              href
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(href);
                    }
                  }
                : undefined
            }
          >
            <CardContent className="p-4">
              <span
                className={cn(
                  "mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  pill,
                )}
              >
                {label}
              </span>
              <p className="text-2xl font-bold tabular-nums">{item.count}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});
