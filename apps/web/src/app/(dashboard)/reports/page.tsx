"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { AgentsCallsTable } from "@/components/reports/agents-calls-table";
import { PieChart } from "@/components/reports/pie-chart";
import { ProjectsGrid } from "@/components/reports/projects-grid";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { StatCard } from "@/components/reports/stat-card";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isForbiddenError, useDashboardReport, useProjectsReport } from "@/hooks/use-reports";
import { Button } from "@propninja/ui/button";
import Link from "next/link";

export default function ReportsPage() {
  const { filters, setFilters, dateFrom, dateTo, userId, labelFrom, labelTo } = useReportFilters();
  const dashboard = useDashboardReport(dateFrom, dateTo, userId);
  const projects = useProjectsReport();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Dashboard overview — leads and mobile call activity ({labelFrom} → {labelTo}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/leads">Leads analytics →</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/reports/calls">Calls report →</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/reports/team">Team performance →</Link>
          </Button>
        </div>
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} />

      {dashboard.isLoading ? (
        <p className="text-muted-foreground">Loading reports...</p>
      ) : dashboard.isError ? (
        isForbiddenError(dashboard.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load reports.</p>
        )
      ) : !dashboard.data ? (
        <p className="text-muted-foreground">Unable to load reports.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="New leads" value={dashboard.data.new_leads_count} hint="In range" />
            <StatCard title="Hot leads" value={dashboard.data.hot_leads_count} hint="In range" />
            <StatCard
              title="Total calls"
              value={dashboard.data.calls_summary.total}
              hint="From mobile app"
            />
            <StatCard
              title="Completed calls"
              value={dashboard.data.calls_summary.completed}
              hint={`${dashboard.data.calls_summary.missed} missed`}
            />
          </div>

          <PieChart
            title="Leads by status"
            items={dashboard.data.leads_by_status.map((row) => ({
              label: row.status,
              value: row.count,
            }))}
          />

          <AgentsCallsTable agents={dashboard.data.calls_by_agent} />

          <div>
            <h2 className="mb-4 text-lg font-semibold">Projects</h2>
            {projects.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            ) : projects.isError && isForbiddenError(projects.error) ? (
              <AccessDeniedEmptyState />
            ) : projects.data ? (
              <ProjectsGrid projects={projects.data.projects} />
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load projects.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
