"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { EmptyState } from "@/components/common/empty-state";
import { HotLeadsTable } from "@/components/dashboard/hot-leads-table";
import { PipelineHealth } from "@/components/dashboard/pipeline-health";
import { PipelineValueCards } from "@/components/dashboard/pipeline-value-cards";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { RevenueKpiRow } from "@/components/dashboard/revenue-kpi-row";
import { TeamPerformanceTable } from "@/components/dashboard/team-performance-table";
import { TodayKpiRow } from "@/components/dashboard/today-kpi-row";
import { LineAreaChart } from "@/components/reports/line-area-chart";
import { useLeads } from "@/hooks/use-leads";
import { isForbiddenError, useOverviewReport, useRecentActivities } from "@/hooks/use-reports";
import { fetchCurrentUser, getSession } from "@/lib/auth";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { BarChart3, Phone, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function AgentDashboard() {
  const session = getSession();
  const myLeads = useLeads({ page: "1", pageSize: "50", assignedTo: session?.id });
  const recentActivities = useRecentActivities();

  const hotLeads = useMemo(
    () => (myLeads.data?.items ?? []).filter((lead) => lead.temperature === "hot"),
    [myLeads.data],
  );

  const followUpsDue = useMemo(() => {
    const now = new Date();
    return (myLeads.data?.items ?? []).filter(
      (lead) => lead.nextFollowupAt && new Date(lead.nextFollowupAt) <= now,
    ).length;
  }, [myLeads.data]);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My dashboard</h2>
        <p className="text-muted-foreground">Your assigned leads and recent activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{myLeads.data?.total ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hot leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{hotLeads.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Follow-ups due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{followUpsDue}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/leads">
            <Users className="mr-2 h-4 w-4" />
            View my leads
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/reports/calls">
            <Phone className="mr-2 h-4 w-4" />
            My calls
          </Link>
        </Button>
      </div>

      {hotLeads.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Hot leads</h3>
            <p className="text-sm text-muted-foreground">Leads that need attention soon.</p>
          </div>
          <HotLeadsTable
            leads={hotLeads.map((lead) => ({
              id: lead.id,
              name: `${lead.firstName} ${lead.lastName}`.trim(),
              phone: lead.phone,
              city: lead.city,
              status: lead.leadStatus,
              last_contacted_at: lead.lastContactedAt,
              next_followup_at: lead.nextFollowupAt ?? null,
            }))}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Recent activity</h3>
          <p className="text-sm text-muted-foreground">Latest notes, calls, and status changes.</p>
        </div>
        {recentActivities.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        ) : (
          <RecentActivityFeed activities={recentActivities.data ?? []} />
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(() => getSession()?.role ?? null);

  useEffect(() => {
    setRole(getSession()?.role ?? null);
    void fetchCurrentUser().then((user) => {
      if (user) setRole(user.role);
    });
  }, []);

  const isAgent = role === "agent";
  const roleKnown = role !== null;

  const overview = useOverviewReport({ enabled: roleKnown && !isAgent });
  const recentActivities = useRecentActivities();

  if (!roleKnown) {
    return <p className="text-muted-foreground">Loading dashboard...</p>;
  }

  if (isAgent) {
    return <AgentDashboard />;
  }

  if (overview.isLoading) {
    return <p className="text-muted-foreground">Loading overview...</p>;
  }

  if (overview.isError) {
    if (isForbiddenError(overview.error)) {
      return <AccessDeniedEmptyState />;
    }
    return (
      <EmptyState
        title="Unable to load dashboard"
        description="Ensure the API server is running and try refreshing the page."
        icon={<BarChart3 className="h-7 w-7" />}
      />
    );
  }

  if (!overview.data) {
    return (
      <EmptyState
        title="Unable to load dashboard"
        description="Ensure the API server is running and try refreshing the page."
        icon={<BarChart3 className="h-7 w-7" />}
      />
    );
  }

  const {
    kpis,
    pipeline,
    revenue,
    leads_by_status,
    calls_last_7_days,
    activity_last_7_days,
    team_performance,
    hot_leads_list,
  } = overview.data;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">Here&apos;s how your funnel is moving this week.</p>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Today at a glance</h3>
          <p className="text-sm text-muted-foreground">How your funnel is moving today.</p>
        </div>
        <TodayKpiRow kpis={kpis} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Pipeline by status</h3>
          <p className="text-sm text-muted-foreground">
            Key stages with estimated value and 30-day activity trend.
          </p>
        </div>
        <PipelineValueCards pipeline={pipeline ?? []} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Revenue</h3>
          <p className="text-sm text-muted-foreground">Won deal value for the current month.</p>
        </div>
        <RevenueKpiRow revenue={revenue} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Pipeline health</h3>
          <p className="text-sm text-muted-foreground">
            Stage mix and activity over the last 7 days.
          </p>
        </div>
        <PipelineHealth
          leadsByStatus={leads_by_status}
          activityLast7Days={activity_last_7_days ?? []}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Calls (last 7 days)</h3>
          <p className="text-sm text-muted-foreground">
            Mobile call volume logged across the team.
          </p>
        </div>
        <LineAreaChart
          title="Calls logged per day"
          points={(calls_last_7_days ?? []).map((row) => ({
            label: row.date,
            value: row.total,
          }))}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Hot leads</h3>
          <p className="text-sm text-muted-foreground">Leads that need attention soon.</p>
        </div>
        <HotLeadsTable leads={hot_leads_list ?? []} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Team snapshot</h3>
          <p className="text-sm text-muted-foreground">
            Mixed-period view — leads owned (current book), calls logged today, deals won this
            month. For today&apos;s stand-up metrics, see{" "}
            <Link href="/reports/team" className="font-medium text-primary hover:underline">
              Team performance
            </Link>
            .
          </p>
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">By agent</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <TeamPerformanceTable team={team_performance ?? []} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Recent activity</h3>
          <p className="text-sm text-muted-foreground">Latest notes, calls, and status changes.</p>
        </div>
        {recentActivities.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        ) : (
          <RecentActivityFeed activities={recentActivities.data ?? []} />
        )}
      </section>
    </div>
  );
}
