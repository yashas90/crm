import { apiGet } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import {
  type ApiCallsListResponse,
  type ApiCallsSummary,
  type CallLogItem,
  callsListQuery,
  callsSummaryQuery,
  mapCallRecordToLogItem,
} from "@/lib/callsApi";
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

export type { CallLogItem } from "@/lib/callsApi";

type CallLogsPage = {
  calls: CallLogItem[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 50;

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
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
      const query = callsListQuery({
        page: pageParam,
        pageSize: PAGE_SIZE,
        dateFrom,
        dateTo,
        outcome,
      });
      const data = await apiGet<ApiCallsListResponse>(`/api/calls?${query}`);
      return {
        calls: data.items.map(mapCallRecordToLogItem),
        total: data.total,
        page: data.page,
        limit: data.pageSize,
      } satisfies CallLogsPage;
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
      apiGet<ApiCallsSummary>(`/api/calls/summary?${callsSummaryQuery(today.dateFrom, today.dateTo)}`),
    enabled: ready,
  });

  const weekQuery = useQuery({
    queryKey: queryKeys.calls.summaryWeek(userId),
    queryFn: () =>
      apiGet<ApiCallsSummary>(`/api/calls/summary?${callsSummaryQuery(week.dateFrom, week.dateTo)}`),
    enabled: ready,
  });

  const weekTotal = weekQuery.data?.total_calls ?? 0;
  const weekAnswered = weekQuery.data?.completed_calls ?? 0;
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
