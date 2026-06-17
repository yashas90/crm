"use client";

import {
  AnalyticsBookedUnits,
  currentMonthIsoRange,
} from "@/components/analytics/analytics-booked-units";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { AnalyticsDateFilter } from "@/components/analytics/analytics-date-filter";
import { AnalyticsHealth } from "@/components/analytics/analytics-health";
import { AnalyticsKpiCards } from "@/components/analytics/analytics-kpi-cards";
import { AnalyticsLeaderboard } from "@/components/analytics/analytics-leaderboard";
import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { useAnalyticsOverview } from "@/hooks/use-analytics";
import { usePermissions } from "@/hooks/use-permissions";
import { isForbiddenError } from "@/hooks/use-reports";
import {
  type AnalyticsFilterValue,
  defaultAnalyticsFilters,
  toAnalyticsApiParams,
} from "@/lib/analytics-filters";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export default function AnalyticsPage() {
  const { canViewReports, ready } = usePermissions();
  const [filters, setFilters] = useState<AnalyticsFilterValue>(defaultAnalyticsFilters);
  const [showBookings, setShowBookings] = useState(false);
  const queryClient = useQueryClient();
  const monthRange = useMemo(() => currentMonthIsoRange(), []);

  const { dateFrom, dateTo, labelFrom, labelTo, rangeLabel } = useMemo(
    () => toAnalyticsApiParams(filters),
    [filters],
  );

  const overview = useAnalyticsOverview(dateFrom, dateTo, ready && canViewReports);

  if (ready && !canViewReports) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Team performance overview for managers and admins.
          </p>
        </div>
        <AccessDeniedEmptyState description="Analytics is limited to managers and admins." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Team performance — {rangeLabel} ({labelFrom} → {labelTo})
        </p>
      </div>

      <AnalyticsDateFilter value={filters} onChange={setFilters} />

      {overview.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={`analytics-kpi-skeleton-${index}`}
              className="h-28 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : overview.isError ? (
        isForbiddenError(overview.error) ? (
          <AccessDeniedEmptyState description="Analytics is limited to managers and admins." />
        ) : (
          <div className="text-sm text-muted-foreground">
            Failed to load.{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => void overview.refetch()}
            >
              Retry
            </button>
          </div>
        )
      ) : !overview.data ? (
        <p className="text-muted-foreground">Unable to load analytics.</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Key metrics</h2>
            <AnalyticsKpiCards
              kpis={overview.data.kpis}
              onBookingsClick={() => setShowBookings((value) => !value)}
            />
          </section>

          {showBookings ? (
            <section className="space-y-4">
              <AnalyticsBookedUnits dateFrom={monthRange.dateFrom} dateTo={monthRange.dateTo} />
            </section>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Charts</h2>
            <AnalyticsCharts charts={overview.data.charts} dateFrom={labelFrom} dateTo={labelTo} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Team leaderboard</h2>
            <AnalyticsLeaderboard rows={overview.data.leaderboard} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Lead health</h2>
            <AnalyticsHealth
              health={overview.data.health}
              onAssignComplete={() =>
                queryClient.invalidateQueries({ queryKey: ["analytics", "overview"] })
              }
            />
          </section>
        </>
      )}
    </div>
  );
}
