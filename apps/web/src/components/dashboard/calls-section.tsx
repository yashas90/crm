"use client";

import type { ActivityOnLeadsOverTimeRow, CallsOverTimeRow } from "@/hooks/use-reports";
import { drillDownRoutes } from "@/lib/drill-down-routes";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { useRouter } from "next/navigation";
import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StatCardProps = {
  label: string;
  value: number;
  accent?: string;
};

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200/80 bg-muted/30 px-3 py-2 dark:border-white/10",
        accent,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function formatDateLabel(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fillCallsDateRange(rows: CallsOverTimeRow[], from: string, to: string) {
  const map = new Map(rows.map((row) => [row.date, row]));
  const result: CallsOverTimeRow[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (cursor <= end) {
    const date = formatDateLabel(cursor);
    const existing = map.get(date);
    result.push(
      existing ?? {
        date,
        total_calls: 0,
        completed_calls: 0,
        missed_calls: 0,
      },
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function fillActivityDateRange(rows: ActivityOnLeadsOverTimeRow[], from: string, to: string) {
  const map = new Map(rows.map((row) => [row.date, row]));
  const result: ActivityOnLeadsOverTimeRow[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (cursor <= end) {
    const date = formatDateLabel(cursor);
    const existing = map.get(date);
    result.push(
      existing ?? {
        date,
        calls: 0,
        meetings: 0,
        notes: 0,
      },
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function sumField<T>(rows: T[], key: keyof T) {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

type CallsSectionProps = {
  callsOverTime: CallsOverTimeRow[];
  activityOnLeads: ActivityOnLeadsOverTimeRow[];
  dateFrom: string;
  dateTo: string;
  rangeLabel: string;
};

export const CallsSection = memo(function CallsSection({
  callsOverTime,
  activityOnLeads,
  dateFrom,
  dateTo,
  rangeLabel,
}: CallsSectionProps) {
  const router = useRouter();

  const handleCallsChartClick = (chartState: { activeLabel?: string | number }) => {
    const date = chartState?.activeLabel;
    if (typeof date === "string" && date.length > 0) {
      router.push(drillDownRoutes.callsByDate(date));
    }
  };

  const callsData = useMemo(
    () => fillCallsDateRange(callsOverTime, dateFrom, dateTo),
    [callsOverTime, dateFrom, dateTo],
  );

  const activityData = useMemo(
    () => fillActivityDateRange(activityOnLeads, dateFrom, dateTo),
    [activityOnLeads, dateFrom, dateTo],
  );

  const callStats = useMemo(
    () => ({
      dialed: sumField(callsData, "total_calls"),
      connected: sumField(callsData, "completed_calls"),
      missed: sumField(callsData, "missed_calls"),
    }),
    [callsData],
  );

  const activityStats = useMemo(
    () => ({
      calls: sumField(activityData, "calls"),
      meetings: sumField(activityData, "meetings"),
      notes: sumField(activityData, "notes"),
    }),
    [activityData],
  );

  const hasCallData = callStats.dialed > 0;
  const hasActivityData =
    activityStats.calls > 0 || activityStats.meetings > 0 || activityStats.notes > 0;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Calls</CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-56 min-w-0 lg:h-64">
            {hasCallData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={callsData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={handleCallsChartClick}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="dialedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="connectedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="missedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => String(value).slice(5)}
                    minTickGap={20}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-border/80 bg-background px-3 py-2 shadow-md">
                          <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                          {payload.map((entry) => (
                            <p
                              key={String(entry.dataKey)}
                              className="text-sm font-medium tabular-nums"
                              style={{ color: entry.color }}
                            >
                              {entry.name}: {entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="total_calls"
                    name="Dialed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#dialedGradient)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed_calls"
                    name="Connected"
                    stroke="#059669"
                    strokeWidth={2}
                    fill="url(#connectedGradient)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="missed_calls"
                    name="Missed"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fill="url(#missedGradient)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No calls logged in this period.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Total dialed" value={callStats.dialed} />
            <StatCard label="Connected" value={callStats.connected} />
            <StatCard label="Missed" value={callStats.missed} />
          </div>
        </CardContent>
      </Card>

      <Card className="">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Activity on leads</CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-56 min-w-0 lg:h-64">
            {hasActivityData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activityCallsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="activityMeetingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="activityNotesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => String(value).slice(5)}
                    minTickGap={20}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-border/80 bg-background px-3 py-2 shadow-md">
                          <p className="mb-1 text-xs text-muted-foreground">{label}</p>
                          {payload.map((entry) => (
                            <p
                              key={String(entry.dataKey)}
                              className="text-sm font-medium tabular-nums"
                              style={{ color: entry.color }}
                            >
                              {entry.name}: {entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    name="Calls"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#activityCallsGradient)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="meetings"
                    name="Meetings"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#activityMeetingsGradient)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="notes"
                    name="Notes"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fill="url(#activityNotesGradient)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No lead activity in this period.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Calls on leads" value={activityStats.calls} />
            <StatCard label="Meetings" value={activityStats.meetings} />
            <StatCard label="Notes" value={activityStats.notes} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
