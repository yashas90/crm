import type { CallLogItem } from "@/hooks/use-call-logs";
import { useIsManager } from "@/hooks/use-role";
import { apiGet } from "@/lib/apiClient";
import {
  type CallDateFilter,
  type CallOutcomeFilter,
  dateRangeForFilter,
} from "@/lib/callLogFilters";
import { type ApiCallsListResponse, callsListQuery, mapCallRecordToLogItem } from "@/lib/callsApi";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/auth-provider";
import { useInfiniteQuery } from "@tanstack/react-query";

export type TeamCallLogItem = CallLogItem & {
  agentName: string | null;
};

const PAGE_SIZE = 50;

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated";
}

export function useTeamCallLogsInfinite(filters: {
  dateFilter: CallDateFilter;
  outcome: CallOutcomeFilter;
  agentId?: string;
}) {
  const ready = useAuthReady();
  const isManager = useIsManager();
  const { dateFrom, dateTo } = dateRangeForFilter(filters.dateFilter);
  const outcome = filters.outcome === "all" ? undefined : filters.outcome;

  return useInfiniteQuery({
    queryKey: queryKeys.calls.team(filters.dateFilter, filters.outcome, filters.agentId ?? "all"),
    queryFn: async ({ pageParam }) => {
      const query = callsListQuery({
        page: pageParam,
        pageSize: PAGE_SIZE,
        dateFrom,
        dateTo,
        userId: filters.agentId,
        outcome,
      });
      const data = await apiGet<ApiCallsListResponse>(`/api/calls?${query}`);

      return {
        calls: data.items.map((item) => ({
          ...mapCallRecordToLogItem(item),
          agentName: item.userName ?? null,
        })) satisfies TeamCallLogItem[],
        total: data.total,
        page: data.page,
        limit: data.pageSize,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.calls.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return lastPage.page + 1;
    },
    enabled: ready && isManager,
  });
}
