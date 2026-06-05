"use client";

import { EmptyState } from "@/components/common/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CallRecord } from "@/hooks/use-leads";
import { cn } from "@propninja/ui/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STATUS_CHIP: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  missed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  rejected: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  failed: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

type LeadCallsPanelProps = {
  calls: CallRecord[];
  mode?: "table" | "chart";
};

export function LeadCallsPanel({ calls, mode = "table" }: LeadCallsPanelProps) {
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    return calls.filter((call) => {
      if (direction && call.direction !== direction) return false;
      if (status && call.status !== status) return false;
      return true;
    });
  }, [calls, direction, status]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const call of calls) {
      const date = call.startedAt.slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [calls]);

  if (mode === "chart") {
    if (chartData.length === 0) {
      return (
        <EmptyState
          title="No call history"
          description="Calls logged from the mobile app will show up here over time."
          icon={<Phone className="h-7 w-7" />}
        />
      );
    }
    return (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="leadCallsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#059669"
              strokeWidth={2}
              fill="url(#leadCallsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const selectClass = "h-9 rounded-lg border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className={selectClass}
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="">All directions</option>
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="missed">Missed</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No calls found"
          description="Try adjusting filters or log a call from the mobile app."
          icon={<Phone className="h-7 w-7" />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Disposition</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((call) => (
              <TableRow
                key={call.id}
                className="transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <TableCell>
                  {call.direction === "incoming" ? (
                    <ArrowDownLeft className="h-4 w-4 text-sky-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_CHIP[call.status] ?? "bg-muted",
                    )}
                  >
                    {call.status}
                  </span>
                </TableCell>
                <TableCell>{formatDuration(call.durationSeconds)}</TableCell>
                <TableCell className="capitalize">{call.disposition ?? "—"}</TableCell>
                <TableCell>{new Date(call.startedAt).toLocaleString()}</TableCell>
                <TableCell>{call.userName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
