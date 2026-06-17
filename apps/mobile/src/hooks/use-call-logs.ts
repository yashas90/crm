import { apiGet } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import {
  type CallDateFilter,
  type CallOutcomeFilter,
  dateRangeForFilter,
  weekRange,
} from "@/lib/callLogFilters";
import { todayRange } from "@/lib/dates";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/auth-provider";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export type CallLogItem = {
  id: string;
  leadId: string | null;
  leadName: string | null;
  phone: string;
  outcome: string | null;
  duration: number;
  notes: string | null;
  calledAt: string;
  agentName?: string | null;
};

type CallLogsPage = {
  calls: CallLogItem[];
  total: number;
  page: number;
  limit: number;
};

export type CallLogsSummary = {
  total_calls: number;
  completed_calls: number;
  missed_calls: number;
  answered_calls: number;
  average_duration: number;
};

const PAGE_SIZE = 50;

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
}

function summaryParams(dateFrom: string, dateTo: string) {
  const params = new URLSearchParams({
    agentId: "me",
    dateFrom,
    dateTo,
  });
  return params.toString();
}

export function useCallLogsInfinite(filters: {
  dateFilter: CallDateFilter;
  outcome: CallOutcomeFilter;
}) {
  const ready = useAuthReady();
  const { dateFrom, dateTo } = dateRangeForFilter(filters.dateFilter);
  const outcome = filters.outcome === "all" ? undefined : filters.outcome;

  return useInfiniteQuery({
    queryKey: queryKeys.calls.history(filters.dateFilter, filters.outcome),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        agentId: "me",
        limit: String(PAGE_SIZE),
        page: String(pageParam),
        dateFrom,
        dateTo,
      });
      if (outcome) params.set("outcome", outcome);

      return apiGet<CallLogsPage>(`/api/calls?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.calls.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return lastPage.page + 1;
    },
    enabled: ready,
  });
}

export function useCallLogsSummaryBar() {
  const ready = useAuthReady();
  const userId = getCurrentUserId();
  const today = todayRange();
  const week = weekRange();

  const todayQuery = useQuery({
    queryKey: queryKeys.calls.summaryToday(userId),
    queryFn: () =>
      apiGet<CallLogsSummary>(`/api/calls/summary?${summaryParams(today.dateFrom, today.dateTo)}`),
    enabled: ready,
  });

  const weekQuery = useQuery({
    queryKey: queryKeys.calls.summaryWeek(userId),
    queryFn: () =>
      apiGet<CallLogsSummary>(`/api/calls/summary?${summaryParams(week.dateFrom, week.dateTo)}`),
    enabled: ready,
  });

  const weekTotal = weekQuery.data?.total_calls ?? 0;
  const weekAnswered = weekQuery.data?.answered_calls ?? 0;
  const answeredPercent =
    weekTotal > 0 ? Math.round((weekAnswered / weekTotal) * 100) : weekQuery.isSuccess ? 0 : null;

  return {
    callsToday: todayQuery.data?.total_calls ?? null,
    callsThisWeek: weekQuery.data?.total_calls ?? null,
    answeredPercent,
    isLoading: todayQuery.isLoading || weekQuery.isLoading,
    refetch: () => Promise.all([todayQuery.refetch(), weekQuery.refetch()]),
  };
}
