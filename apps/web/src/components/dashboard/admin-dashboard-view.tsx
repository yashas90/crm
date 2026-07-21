"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { EmptyState } from "@/components/common/empty-state";
import { SectionErrorBoundary } from "@/components/common/section-error-boundary";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import {
  CallsSectionSkeleton,
  ChartCardSkeleton,
  KpiStripSkeleton,
  SourcesPanelSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { HotLeadsTable } from "@/components/dashboard/hot-leads-table";
import { LeadsSourceHero } from "@/components/dashboard/leads-source-hero";
import { OverviewKpiStrip } from "@/components/dashboard/overview-kpi-strip";
import dynamic from "next/dynamic";
const PipelineHealth = dynamic(
  () =>
    import("@/components/dashboard/pipeline-health").then((m) => ({ default: m.PipelineHealth })),
  { ssr: false },
);
import { PipelineValueCards } from "@/components/dashboard/pipeline-value-cards";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { RemindersPanel } from "@/components/dashboard/reminders-panel";
import { RevenueKpiRow } from "@/components/dashboard/revenue-kpi-row";
import { StatusKpiRow } from "@/components/dashboard/status-kpi-row";
import { TeamPerformanceTable } from "@/components/dashboard/team-performance-table";
import { TodayKpiRow } from "@/components/dashboard/today-kpi-row";
import { SlaAlertPanel } from "@/components/sla/sla-alert-panel";
import { NeuSectionHeading } from "@/components/ui/neubrutal";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardReports } from "@/hooks/use-dashboard-reports";
import { isForbiddenError, useRecentActivities } from "@/hooks/use-reports";
import {
  type DashboardFilterValue,
  defaultDashboardFilters,
  toDashboardApiParams,
} from "@/lib/dashboard-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { Suspense, lazy, useMemo, useState } from "react";

const LeadsReceivedChart = lazy(() =>
  import("@/components/dashboard/leads-received-chart").then((module) => ({
    default: module.LeadsReceivedChart,
  })),
);

const CallsSection = lazy(() =>
  import("@/components/dashboard/calls-section").then((module) => ({
    default: module.CallsSection,
  })),
);

function BottomOverviewSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={`today-kpi-${index}`} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={`pipeline-${index}`} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl lg:h-72" />
    </div>
  );
}

type AdminDashboardViewProps = {
  enabled: boolean;
};

export function AdminDashboardView({ enabled }: AdminDashboardViewProps) {
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilterValue>(() =>
    defaultDashboardFilters(),
  );

  const reportParams = useMemo(() => toDashboardApiParams(dashboardFilters), [dashboardFilters]);

  const { overview, sources, leads, calls } = useDashboardReports(reportParams, { enabled });
  const recentActivities = useRecentActivities();

  if (overview.isError && isForbiddenError(overview.error)) {
    return <AccessDeniedEmptyState />;
  }

  const overviewData = overview.data;
  const rangeLabelLower = reportParams.rangeLabel.toLowerCase();

  return (
    <div className="space-y-12">
      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-12 lg:col-span-9">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Command Centre
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Funnel performance for {rangeLabelLower}.
              {overview.isFetching && overviewData ? (
                <span className="ml-2 text-xs">Updating…</span>
              ) : null}{" "}
              <Link href="/analytics" className="font-medium text-primary hover:underline">
                Full analytics →
              </Link>
            </p>
          </header>

          <DashboardFilterBar value={dashboardFilters} onChange={setDashboardFilters} />

          <DashboardSection
            isLoading={sources.isLoading}
            isError={sources.isError}
            hasData={Boolean(sources.data?.leads_from_source?.length)}
            onRetry={() => void sources.refetch()}
            skeleton={<SourcesPanelSkeleton />}
            className="space-y-0"
          >
            {sources.data?.leads_from_source ? (
              <Suspense fallback={<SourcesPanelSkeleton />}>
                <SectionErrorBoundary title="Couldn't load lead sources">
                  <LeadsSourceHero groups={sources.data.leads_from_source} />
                </SectionErrorBoundary>
              </Suspense>
            ) : null}
          </DashboardSection>

          <DashboardSection
            title="Lead pipeline"
            description="Live counts across your book — scroll on smaller screens."
            isLoading={overview.isLoading}
            isError={overview.isError}
            hasData={Boolean(overviewData?.lead_strip)}
            onRetry={() => void overview.refetch()}
            skeleton={<KpiStripSkeleton />}
          >
            {overviewData?.lead_strip ? (
              <SectionErrorBoundary title="Couldn't load lead pipeline">
                <OverviewKpiStrip strip={overviewData.lead_strip} />
              </SectionErrorBoundary>
            ) : null}
          </DashboardSection>

          <DashboardSection
            title="Pipeline by status"
            description="Current lead counts by stage (all active leads)."
            isLoading={overview.isLoading}
            isError={overview.isError}
            hasData={Boolean(overviewData?.status_breakdown?.length)}
            onRetry={() => void overview.refetch()}
            skeleton={<KpiStripSkeleton />}
          >
            {overviewData?.status_breakdown ? (
              <SectionErrorBoundary title="Couldn't load status breakdown">
                <StatusKpiRow items={overviewData.status_breakdown} />
              </SectionErrorBoundary>
            ) : null}
          </DashboardSection>

          <DashboardSection
            isLoading={leads.isLoading}
            isError={leads.isError}
            hasData={Boolean(leads.data?.leads_over_time)}
            onRetry={() => void leads.refetch()}
            skeleton={<ChartCardSkeleton tall />}
            className="space-y-0"
          >
            {leads.data?.leads_over_time ? (
              <Suspense fallback={<ChartCardSkeleton tall />}>
                <SectionErrorBoundary title="Couldn't load leads chart">
                  <LeadsReceivedChart
                    rows={leads.data.leads_over_time}
                    rangeLabel={reportParams.rangeLabel}
                    dateFrom={reportParams.labelFrom}
                    dateTo={reportParams.labelTo}
                  />
                </SectionErrorBoundary>
              </Suspense>
            ) : null}
          </DashboardSection>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Calls &amp; activity</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Call outcomes and touchpoints on leads for {rangeLabelLower}.
              </p>
            </div>
            <DashboardSection
              isLoading={calls.isLoading}
              isError={calls.isError}
              hasData={Boolean(
                calls.data?.calls_over_time && calls.data.activity_on_leads_over_time,
              )}
              onRetry={() => void calls.refetch()}
              skeleton={<CallsSectionSkeleton />}
              className="space-y-0"
            >
              {calls.data?.calls_over_time && calls.data.activity_on_leads_over_time ? (
                <Suspense fallback={<CallsSectionSkeleton />}>
                  <SectionErrorBoundary title="Couldn't load calls chart">
                    <CallsSection
                      callsOverTime={calls.data.calls_over_time}
                      activityOnLeads={calls.data.activity_on_leads_over_time}
                      rangeLabel={reportParams.rangeLabel}
                      dateFrom={reportParams.labelFrom}
                      dateTo={reportParams.labelTo}
                    />
                  </SectionErrorBoundary>
                </Suspense>
              ) : null}
            </DashboardSection>
          </section>

          {overview.isLoading && !overviewData ? (
            <BottomOverviewSkeleton />
          ) : overview.isError ? (
            <EmptyState
              title="Couldn't load overview details"
              description="Pipeline, revenue, and team sections failed to load."
              actionLabel="Retry"
              onActionClick={() => void overview.refetch()}
              icon={<BarChart3 className="h-7 w-7" />}
            />
          ) : overviewData ? (
            <>
              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Today at a glance</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Key metrics for {rangeLabelLower}.
                  </p>
                </div>
                <TodayKpiRow kpis={overviewData.kpis} />
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pipeline by status</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Key stages with estimated value and activity trend.
                  </p>
                </div>
                <PipelineValueCards pipeline={overviewData.pipeline ?? []} />
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Revenue</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Won deal value for the selected period.
                  </p>
                </div>
                <RevenueKpiRow revenue={overviewData.revenue} />
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pipeline health</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Stage mix and activity for {rangeLabelLower}.
                  </p>
                </div>
                <SectionErrorBoundary title="Couldn't load pipeline health">
                  <PipelineHealth
                    leadsByStatus={overviewData.leads_by_status}
                    activityLast7Days={overviewData.activity_last_7_days ?? []}
                  />
                </SectionErrorBoundary>
              </section>

              <section className="space-y-4">
                <NeuSectionHeading title="Hot Leads" />
                <HotLeadsTable leads={overviewData.hot_leads_list ?? []} />
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Team snapshot</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Leads owned, calls, and deals won in the selected period. See{" "}
                    <Link href="/reports/team" className="font-medium text-primary hover:underline">
                      Team performance
                    </Link>{" "}
                    for stand-up metrics.
                  </p>
                </div>
                <Card className="">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base">By agent</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto pt-4">
                    <TeamPerformanceTable team={overviewData.team_performance ?? []} />
                  </CardContent>
                </Card>
              </section>
            </>
          ) : null}

          <section>
            {recentActivities.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : recentActivities.isError ? (
              <EmptyState
                title="Couldn't load activity"
                description="Recent activity failed to load."
                actionLabel="Retry"
                onActionClick={() => void recentActivities.refetch()}
              />
            ) : (
              <RecentActivityFeed activities={recentActivities.data ?? []} />
            )}
          </section>
        </div>

        <aside className="hidden min-w-0 space-y-4 lg:col-span-3 lg:block">
          <div className="sticky top-24 space-y-4">
            <SlaAlertPanel />
            <RemindersPanel />
          </div>
        </aside>
      </div>

      <div className="space-y-4 lg:hidden">
        <SlaAlertPanel />
        <RemindersPanel collapsible />
      </div>
    </div>
  );
}
