"use client";

import { AnalyticsBookedUnits } from "@/components/analytics/analytics-booked-units";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { AnalyticsDateFilter } from "@/components/analytics/analytics-date-filter";
import { AnalyticsHealth } from "@/components/analytics/analytics-health";
import { AnalyticsKpiCards } from "@/components/analytics/analytics-kpi-cards";
import { AnalyticsLeaderboard } from "@/components/analytics/analytics-leaderboard";
import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { useAnalyticsOverview, useRefreshAnalyticsOverview } from "@/hooks/use-analytics";
import { usePermissions } from "@/hooks/use-permissions";
import { isForbiddenError } from "@/hooks/use-reports";
import {
  type AnalyticsFilterValue,
  defaultAnalyticsFilters,
  toAnalyticsApiParams,
} from "@/lib/analytics-filters";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, BookMarked, LineChart, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function AnalyticsPage() {
  const { canViewReports, ready } = usePermissions();
  const [filters, setFilters] = useState<AnalyticsFilterValue>(defaultAnalyticsFilters);
  const queryClient = useQueryClient();
  const refresh = useRefreshAnalyticsOverview();

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Team performance — {rangeLabel} ({labelFrom} → {labelTo})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refresh.isPending || overview.isFetching}
            onClick={() => {
              refresh.mutate(
                { dateFrom, dateTo },
                {
                  onSuccess: () => toast.success("Analytics refreshed"),
                  onError: () => toast.error("Could not refresh analytics"),
                },
              );
            }}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                (refresh.isPending || overview.isFetching) && "animate-spin",
              )}
            />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/reports">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reports
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/reports/team">
              <Users className="mr-2 h-4 w-4" />
              Team
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/reports/revenue">
              <LineChart className="mr-2 h-4 w-4" />
              Revenue
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/bookings">
              <BookMarked className="mr-2 h-4 w-4" />
              Bookings
            </Link>
          </Button>
        </div>
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
            <AnalyticsKpiCards kpis={overview.data.kpis} />
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Bookings in period</h2>
              <Link href="/bookings" className="text-sm text-primary hover:underline">
                All bookings →
              </Link>
            </div>
            <AnalyticsBookedUnits dateFrom={dateFrom} dateTo={dateTo} />
          </section>

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
