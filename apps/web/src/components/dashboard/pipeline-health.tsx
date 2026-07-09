"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
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

const STAGE_COLORS: Record<string, string> = {
  new: "#0ea5e9",
  contacted: "#f59e0b",
  qualified: "#14b8a6",
  negotiation: "#6366f1",
  won: "#059669",
  lost: "#94a3b8",
};

const ACTIVE_STAGES = ["new", "contacted", "qualified", "negotiation", "won"] as const;

type PipelineHealthProps = {
  leadsByStatus: { status: string; count: number }[];
  activityLast7Days: { date: string; leads: number; calls: number }[];
};

function pipelineInsight(leadsByStatus: { status: string; count: number }[]) {
  const active = leadsByStatus.filter((r) => r.status !== "lost");
  const total = active.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return "Add leads to start building your pipeline.";

  const sorted = [...active].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  if (!top) return "Pipeline looks balanced across stages.";

  if (top.status === "contacted") {
    return "Most leads are stuck at Contacted. Try focusing calls there.";
  }
  if (top.status === "new") {
    return "A large share is still New — prioritize first contact today.";
  }
  if (top.status === "negotiation") {
    return "Strong negotiation volume — push for closures this week.";
  }
  return `Most leads are at ${top.status}. Keep momentum on that stage.`;
}

export function PipelineHealth({ leadsByStatus, activityLast7Days }: PipelineHealthProps) {
  const activeCounts = ACTIVE_STAGES.map((stage) => {
    const row = leadsByStatus.find((r) => r.status === stage);
    return { stage, count: row?.count ?? 0 };
  });
  const total = activeCounts.reduce((sum, r) => sum + r.count, 0) || 1;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className=" transition-all duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-base">Pipeline by stage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Proportions across active leads in your book.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-4 overflow-hidden rounded-full">
            {activeCounts.map((row) =>
              row.count > 0 ? (
                <div
                  key={row.stage}
                  className="transition-all duration-300"
                  style={{
                    width: `${(row.count / total) * 100}%`,
                    backgroundColor: STAGE_COLORS[row.stage],
                  }}
                  title={`${row.stage}: ${row.count}`}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {activeCounts.map((row) => (
              <div key={row.stage} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STAGE_COLORS[row.stage] }}
                />
                <span className="capitalize text-muted-foreground">{row.stage}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {pipelineInsight(leadsByStatus)}
          </p>
        </CardContent>
      </Card>

      <Card className=" transition-all duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-base">Calls vs leads (last 7 days)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Are calls keeping up with new lead influx?
          </p>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityLast7Days}>
              <defs>
                <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="callsActivityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => String(v).slice(5)}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="leads"
                name="Leads created"
                stroke="#6366f1"
                fill="url(#leadsGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="calls"
                name="Calls logged"
                stroke="#059669"
                fill="url(#callsActivityGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
