import { apiGet } from "@/lib/apiClient";
import { todayRange } from "@/lib/dates";
import { liveQueryOptions } from "@/lib/liveQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@tanstack/react-query";

const STALE_TIME_MS = 5 * 60 * 1000;
const live = liveQueryOptions();

export type TeamMemberStats = {
  userId: string;
  name: string;
  email: string;
  leadsAssigned: number;
  callsMade: number;
  tasksCompleted: number;
  conversionRate: number;
};

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated";
}

export function useTeamTodayReport() {
  const ready = useAuthReady();
  const { dateFrom, dateTo } = todayRange();
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });

  return useQuery({
    queryKey: queryKeys.reports.teamToday(dateFrom, dateTo),
    queryFn: () => apiGet<{ users: TeamMemberStats[] }>(`/api/reports/team-today?${params}`),
    enabled: ready,
    staleTime: STALE_TIME_MS,
    ...live,
  });
}
