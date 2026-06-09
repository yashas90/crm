"use client";

import type { LeadsOverTimeRow } from "@/hooks/use-reports";
import { drillDownRoutes } from "@/lib/drill-down-routes";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useRouter } from "next/navigation";
import { memo, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SourceFilter = "all" | "Social" | "Portals" | "Others";

const FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "Social", label: "Social" },
  { value: "Portals", label: "Portals" },
  { value: "Others", label: "Others" },
];

function formatDateLabel(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fillDateRange(points: { date: string; count: number }[], from: string, to: string) {
  const counts = new Map(points.map((point) => [point.date, point.count]));
  const result: { date: string; count: number }[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (cursor <= end) {
    const date = formatDateLabel(cursor);
    result.push({ date, count: counts.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function aggregateByDate(rows: LeadsOverTimeRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.date, (totals.get(row.date) ?? 0) + row.count);
  }
  return [...totals.entries()].map(([date, count]) => ({ date, count }));
}

type LeadsReceivedChartProps = {
  rows: LeadsOverTimeRow[];
  rangeLabel: string;
  dateFrom: string;
  dateTo: string;
};

export const LeadsReceivedChart = memo(function LeadsReceivedChart({
  rows,
  rangeLabel,
  dateFrom,
  dateTo,
}: LeadsReceivedChartProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<SourceFilter>("all");

  const handleChartClick = (chartState: { activeLabel?: string | number }) => {
    const date = chartState?.activeLabel;
    if (typeof date === "string" && date.length > 0) {
      router.push(drillDownRoutes.leadsByDate(date));
    }
  };

  const chartData = useMemo(() => {
    const filtered =
      filter === "all"
        ? aggregateByDate(rows)
        : rows
            .filter((row) => row.sourceGroup === filter)
            .map((row) => ({ date: row.date, count: row.count }));

    return fillDateRange(filtered, dateFrom, dateTo);
  }, [rows, filter, dateFrom, dateTo]);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Leads Received</CardTitle>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="h-56 min-w-0 lg:h-64 xl:h-72">
        {chartData.every((point) => point.count === 0) ? (
          <p className="text-sm text-muted-foreground">No leads received in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={handleChartClick}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="leadsReceivedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => String(value).slice(5)}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const count = payload[0]?.value;
                  return (
                    <div className="rounded-lg border border-border/80 bg-background px-3 py-2 shadow-md">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {typeof count === "number" ? count : 0} leads
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#leadsReceivedGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#d97706" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
});
