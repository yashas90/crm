"use client";

import { useAgentStats } from "@/hooks/use-agent-stats";
import { usePermissions } from "@/hooks/use-permissions";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TabId = "today" | "month";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function AgentPerformanceContent() {
  const { isAdmin, isManager } = usePermissions();
  const canPickAgent = isAdmin || isManager;
  const { data: users } = useUsers(undefined, { enabled: canPickAgent });
  const agents = useMemo(
    () => (users ?? []).filter((u) => u.role === "agent" || u.role === "manager"),
    [users],
  );

  const [agentId, setAgentId] = useState<string>("");
  const [tab, setTab] = useState<TabId>("today");

  const stats = useAgentStats(agentId || undefined);

  const chartData = useMemo(
    () =>
      (stats.data?.callsLast7Days ?? []).map((point) => ({
        date: point.date.slice(5),
        calls: point.count,
      })),
    [stats.data?.callsLast7Days],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Performance</h1>
          <p className="text-sm text-muted-foreground">
            Personal calls, leads, and tasks — today and this month.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={stats.isFetching}
            onClick={() => void stats.refetch()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", stats.isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/reports/calls">Call reports</Link>
          </Button>
        </div>
      </div>

      {canPickAgent ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">View agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="perfAgent">Agent</Label>
              <select
                id="perfAgent"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Me</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2">
        {(["today", "month"] as TabId[]).map((id) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(id)}
          >
            {id === "today" ? "Today" : "This month"}
          </Button>
        ))}
      </div>

      {stats.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading performance…</p>
      ) : stats.isError ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Could not load performance.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void stats.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : stats.data ? (
        <>
          {tab === "today" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Calls made" value={String(stats.data.today.callsMade)} />
              <StatTile
                label="Calls answered"
                value={String(stats.data.today.callsAnswered)}
                sub={`${stats.data.today.callsAnsweredPercent}% answered`}
              />
              <StatTile label="Leads contacted" value={String(stats.data.today.leadsContacted)} />
              <StatTile label="Tasks completed" value={String(stats.data.today.tasksCompleted)} />
              <StatTile
                label="New leads assigned"
                value={String(stats.data.today.newLeadsAssigned)}
              />
              <StatTile label="Follow-ups done" value={String(stats.data.today.followUpsDone)} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Total calls" value={String(stats.data.thisMonth.totalCalls)} />
              <StatTile label="Answered %" value={`${stats.data.thisMonth.answeredPercent}%`} />
              <StatTile
                label="Avg call duration"
                value={`${stats.data.thisMonth.avgCallDurationMinutes} min`}
              />
              <StatTile label="Leads won" value={String(stats.data.thisMonth.leadsConverted)} />
              <StatTile
                label="Assigned / contacted"
                value={`${stats.data.thisMonth.leadsAssigned} / ${stats.data.thisMonth.leadsContacted}`}
                sub={`${stats.data.thisMonth.leadsAssignedVsContactedRatio}% contacted`}
              />
              <StatTile
                label="Tasks"
                value={`${stats.data.thisMonth.tasksCompleted} done`}
                sub={`${stats.data.thisMonth.tasksOverdue} overdue`}
              />
              <StatTile
                label="Best day"
                value={
                  stats.data.thisMonth.bestDay
                    ? new Date(stats.data.thisMonth.bestDay.date).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"
                }
                sub={
                  stats.data.thisMonth.bestDay
                    ? `${stats.data.thisMonth.bestDay.calls} calls`
                    : undefined
                }
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calls — last 7 days</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              {chartData.every((p) => p.calls === 0) ? (
                <p className="text-sm text-muted-foreground">No calls in the last week.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip formatter={(value) => [`${value}`, "Calls"]} />
                    <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {!canPickAgent || !agentId ? (
            <Card className="border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <CardContent className="flex items-start gap-3 py-4">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-foreground">
                    Rank #{stats.data.leaderboard.rank} of {stats.data.leaderboard.totalAgents}{" "}
                    agents
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Based on calls made this month. Keep dialing!
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
