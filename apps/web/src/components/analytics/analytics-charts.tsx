"use client";

import { PieChart } from "@/components/reports/pie-chart";
import type { AnalyticsOverview } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fillDateRange(points: { date: string; count: number }[], from: string, to: string) {
  const counts = new Map(points.map((p) => [p.date, p.count]));
  const result: { date: string; count: number }[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    result.push({ date, count: counts.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

type AnalyticsChartsProps = {
  charts: AnalyticsOverview["charts"];
  dateFrom: string;
  dateTo: string;
};

export function AnalyticsCharts({ charts, dateFrom, dateTo }: AnalyticsChartsProps) {
  const leadsOverTime = useMemo(
    () => fillDateRange(charts.leadsOverTime, dateFrom, dateTo),
    [charts.leadsOverTime, dateFrom, dateTo],
  );

  const funnelData = useMemo(
    () =>
      charts.leadFunnel.map((row) => ({
        stage: formatStage(row.stage),
        count: row.count,
      })),
    [charts.leadFunnel],
  );

  const sourceData = useMemo(
    () => charts.leadSources.map((row) => ({ label: row.source, value: row.count })),
    [charts.leadSources],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Leads over time</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {leadsOverTime.every((p) => p.count === 0) ? (
            <p className="text-sm text-muted-foreground">No leads in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => String(v).slice(5)}
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                <Tooltip
                  formatter={(value) => [`${value} leads`, "New leads"]}
                  labelFormatter={(label) => String(label)}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lead funnel</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {funnelData.every((p) => p.count === 0) ? (
            <p className="text-sm text-muted-foreground">No pipeline data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" width={88} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}`, "Leads"]} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <PieChart
        title="Calls by outcome"
        items={charts.callsByOutcome.map((row) => ({
          label: row.outcome,
          value: row.count,
        }))}
      />

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lead sources</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {sourceData.every((p) => p.value === 0) ? (
            <p className="text-sm text-muted-foreground">No source data in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                <Tooltip formatter={(value) => [`${value}`, "Leads"]} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
