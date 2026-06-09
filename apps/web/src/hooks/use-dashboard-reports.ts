"use client";

import type { DashboardReportParams } from "@/hooks/use-reports";
import {
  useCallsReport,
  useLeadsReport,
  useOverviewReport,
  useSourceReport,
} from "@/hooks/use-reports";
import { useCallback } from "react";

/** Single entry point for dashboard report queries — avoids duplicate hook wiring. */
export function useDashboardReports(
  params: DashboardReportParams,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;

  const overview = useOverviewReport({ ...params, enabled });
  const sources = useSourceReport({ ...params, enabled });
  const leads = useLeadsReport(params, { enabled });
  const calls = useCallsReport(params, { enabled });

  const refetchAll = useCallback(
    () => Promise.all([overview.refetch(), sources.refetch(), leads.refetch(), calls.refetch()]),
    [overview, sources, leads, calls],
  );

  return {
    overview,
    sources,
    leads,
    calls,
    refetchAll,
    isInitialLoading:
      (overview.isLoading && !overview.data) ||
      (sources.isLoading && !sources.data) ||
      (leads.isLoading && !leads.data) ||
      (calls.isLoading && !calls.data),
    isForbidden: overview.isError,
  };
}
