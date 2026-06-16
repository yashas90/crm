"use client";

import { apiDownload, apiGet } from "@/lib/apiClient";
// Team report requires manager/admin; use isForbiddenError() in pages for 403 UX.
import { useQuery } from "@tanstack/react-query";
export { isForbiddenError } from "@/lib/query-errors";
import { defaultDateRange, toApiDateFrom, toApiDateTo } from "@/lib/date-range";

export type TeamMemberStats = {
  userId: string;
  name: string;
  email: string;
  leadsAssigned: number;
  callsMade: number;
  tasksCompleted: number;
  conversionRate: number;
};

type TeamReportParams = {
  dateFrom: string;
  dateTo: string;
};

export function useTeamReport(params: TeamReportParams) {
  const searchParams = new URLSearchParams({
    date_from: toApiDateFrom(params.dateFrom),
    date_to: toApiDateTo(params.dateTo),
  });

  return useQuery({
    queryKey: ["reports", "team-today", params.dateFrom, params.dateTo],
    queryFn: () =>
      apiGet<{ users: TeamMemberStats[] }>(`/api/reports/team-today?${searchParams.toString()}`),
  });
}

export async function downloadTeamPerformanceCsv(params: TeamReportParams) {
  const searchParams = new URLSearchParams({
    date_from: toApiDateFrom(params.dateFrom),
    date_to: toApiDateTo(params.dateTo),
  });
  const date = new Date().toISOString().slice(0, 10);
  await apiDownload(
    `/api/reports/team-today/export?${searchParams.toString()}`,
    `team-performance-${date}.csv`,
  );
}

export function todayDateRange() {
  return defaultDateRange(0);
}

export function weekDateRange() {
  return defaultDateRange(7);
}
