"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { BarChart } from "@/components/reports/bar-chart";
import { LineAreaChart } from "@/components/reports/line-area-chart";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { StatCard } from "@/components/reports/stat-card";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isForbiddenError, useLeadsReport } from "@/hooks/use-reports";
import { Button } from "@propninja/ui/button";
import Link from "next/link";

function formatAvgTimeToFirstCall(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)} hr`;
  return `${(seconds / 86_400).toFixed(1)} days`;
}

export default function LeadsAnalyticsPage() {
  const { filters, setFilters, dateFrom, dateTo, labelFrom, labelTo } = useReportFilters();
  const report = useLeadsReport(dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads analytics</h1>
          <p className="text-muted-foreground">
            New lead volume, status transitions, and speed to first call ({labelFrom} → {labelTo}).
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/reports">← Reports</Link>
        </Button>
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} />

      {report.isLoading ? (
        <p className="text-muted-foreground">Loading leads analytics...</p>
      ) : report.isError ? (
        isForbiddenError(report.error) ? (
          <AccessDeniedEmptyState />
        ) : (
          <p className="text-muted-foreground">Unable to load leads analytics.</p>
        )
      ) : !report.data ? (
        <p className="text-muted-foreground">Unable to load leads analytics.</p>
      ) : (
        <div className="space-y-6">
          <StatCard
            title="Avg time to first call"
            value={formatAvgTimeToFirstCall(report.data.avg_time_to_first_call)}
            hint="From lead creation to first logged call"
          />

          <LineAreaChart
            title="New leads over time"
            points={report.data.new_leads_over_time.map((row) => ({
              label: row.date,
              value: row.count,
            }))}
          />

          <BarChart
            title="Status conversions"
            items={report.data.status_conversion.map((row) => ({
              label: `${row.from_status} → ${row.to_status}`,
              value: row.count,
            }))}
          />
        </div>
      )}
    </div>
  );
}
