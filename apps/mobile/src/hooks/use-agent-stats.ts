import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@tanstack/react-query";

const STALE_TIME_MS = 5 * 60 * 1000;

export type AgentStatsToday = {
  callsMade: number;
  callsAnswered: number;
  callsAnsweredPercent: number;
  leadsContacted: number;
  tasksCompleted: number;
  newLeadsAssigned: number;
  followUpsDone: number;
};

export type AgentStatsMonth = {
  totalCalls: number;
  answeredPercent: number;
  avgCallDurationMinutes: number;
  leadsConverted: number;
  leadsAssigned: number;
  leadsContacted: number;
  leadsAssignedVsContactedRatio: number;
  tasksCompleted: number;
  tasksOverdue: number;
  bestDay: { date: string; calls: number } | null;
};

export type AgentStatsLeaderboardEntry = {
  agentId: string;
  agentName: string;
  callsThisMonth: number;
  leadsConverted: number;
  rank: number;
};

export type AgentStats = {
  today: AgentStatsToday;
  thisMonth: AgentStatsMonth;
  callsLast7Days: { date: string; count: number }[];
  leaderboard: {
    rank: number;
    totalAgents: number;
    metric: "callsThisMonth";
    entries: AgentStatsLeaderboardEntry[];
  };
};

export function useAgentStats(agentId?: string) {
  const { status } = useAuth();
  const params = new URLSearchParams();
  if (agentId) params.set("agentId", agentId);

  const query = params.toString();
  const path = query ? `/api/reports/agent-stats?${query}` : "/api/reports/agent-stats";

  return useQuery({
    queryKey: queryKeys.reports.agentStats(agentId ?? "me"),
    queryFn: () => apiGet<AgentStats>(path),
    enabled: status === "authenticated",
    staleTime: STALE_TIME_MS,
  });
}
