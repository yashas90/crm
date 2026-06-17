import type { CallLogItem } from "@/hooks/use-call-logs";
import { useIsManager } from "@/hooks/use-role";
import { apiGet } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import {
  type CallDateFilter,
  type CallOutcomeFilter,
  dateRangeForFilter,
} from "@/lib/callLogFilters";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/auth-provider";
import { useInfiniteQuery } from "@tanstack/react-query";

export type TeamCallLogItem = CallLogItem & {
  agentName: string | null;
};

const PAGE_SIZE = 50;

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
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
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(pageParam),
        dateFrom,
        dateTo,
      });
      if (filters.agentId) params.set("agentId", filters.agentId);
      if (outcome) params.set("outcome", outcome);

      const data = await apiGet<{
        calls: TeamCallLogItem[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/calls?${params.toString()}`);

      return {
        calls: data.calls,
        total: data.total,
        page: data.page,
        limit: data.limit,
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
