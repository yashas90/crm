"use client";

import { CallsListTable } from "@/components/calls/calls-list-table";
import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { BarChart } from "@/components/reports/bar-chart";
import { LineAreaChart } from "@/components/reports/line-area-chart";
import { PieChart } from "@/components/reports/pie-chart";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { useCalls } from "@/hooks/use-leads";
import { useReportFilters } from "@/hooks/use-report-filters";
import { isForbiddenError, useCallsReport } from "@/hooks/use-reports";
import { toApiRange } from "@/lib/report-filters";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function CallsReportPage() {
  const { filters, setFilters, dateFrom, dateTo, userId, labelFrom, labelTo } = useReportFilters();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const report = useCallsReport(dateFrom, dateTo, userId);

  const detailRange = selectedDate ? toApiRange(selectedDate, selectedDate) : { dateFrom, dateTo };

  const callsList = useCalls({
    user_id: userId,
    date_from: detailRange.dateFrom,
    date_to: detailRange.dateTo,
    page: "1",
    pageSize: "100",
  });

  useEffect(() => {
    if (selectedDate && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDate]);

  const reportForbidden = report.isError && isForbiddenError(report.error);
  const showAnalytics = !reportForbidden && report.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {reportForbidden ? "My calls" : "Calls report"}
          </h1>
          <p className="text-muted-foreground">
            {reportForbidden
              ? `Your call history synced from the mobile app (${labelFrom} → ${labelTo}).`
              : `Call analytics synced from the mobile app — read-only on web (${labelFrom} → ${labelTo}).`}
          </p>
        </div>
        {!reportForbidden ? (
          <Button variant="outline" asChild>
            <Link href="/reports">← Dashboard report</Link>
          </Button>
        ) : null}
      </div>

      <ReportFilterBar value={filters} onChange={setFilters} />

      {report.isLoading ? (
        <p className="text-muted-foreground">Loading call analytics...</p>
      ) : report.isError && !reportForbidden ? (
        <p className="text-muted-foreground">Unable to load call report.</p>
      ) : showAnalytics ? (
        <div className="space-y-6">
          <LineAreaChart
            title="Calls over time (click a point to drill down)"
            points={report.data.calls_over_time.map((row) => ({
              label: row.date,
              value: row.total_calls,
            }))}
            selectedLabel={selectedDate ?? undefined}
            onPointClick={(label) => setSelectedDate(label)}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <PieChart
              title="Disposition breakdown"
              items={report.data.disposition_breakdown.map((row) => ({
                label: row.disposition,
                value: row.count,
              }))}
            />
            <PieChart
              title="Direction breakdown"
              items={report.data.direction_breakdown.map((row) => ({
                label: row.direction,
                value: row.count,
              }))}
            />
          </div>

          <BarChart
            title="Direction breakdown (bar)"
            items={report.data.direction_breakdown.map((row) => ({
              label: row.direction,
              value: row.count,
            }))}
          />
        </div>
      ) : null}

      <div ref={detailsRef}>
        <Card className={selectedDate ? "ring-2 ring-primary" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Call details</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedDate
                  ? `Showing calls on ${selectedDate}`
                  : `All calls in ${labelFrom} → ${labelTo}`}
              </p>
            </div>
            {selectedDate ? (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(null)}>
                Clear selection
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {callsList.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading calls...</p>
            ) : callsList.isError ? (
              isForbiddenError(callsList.error) ? (
                <AccessDeniedEmptyState />
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load call list.</p>
              )
            ) : callsList.data ? (
              <CallsListTable calls={callsList.data.items} showLead />
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load call list.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
