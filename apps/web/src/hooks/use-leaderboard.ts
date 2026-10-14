"use client";

import { apiDownload, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { SILENT_QUERY_ERROR_META } from "@/lib/query-meta";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeaderboardPeriod = "month" | "quarter" | "year" | "all";
export type LeaderboardScope = "team" | "all" | "branch";

export type LeaderboardBadge = { type: string; name: string; tooltip: string };

export type LeaderboardRow = {
  rank: number;
  previousRank: number | null;
  trend: "up" | "down" | "flat";
  trendDelta: number;
  userId: string | null;
  agentName: string;
  designation: string | null;
  grade: string | null;
  teamName: string;
  avatarUrl: string | null;
  initials: string;
  totalNr: number;
  targetAchievementPercent: number;
  dealsClosed: number;
  unitsClosed: number;
  nrThisWeek: number;
  nrLastWeek: number;
  streakDays: number;
  badges: LeaderboardBadge[];
  gapToNext: number;
  gapToTop3: number;
  nameAbove: string | null;
  jumpToRank: number | null;
  personalBest: boolean;
  masked: boolean;
};

export type LeaderboardPayload = {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  periodKey: string;
  scopeKey: string;
  generatedAt: string;
  countdown: { days: number; hours: number };
  announcement: { id: string; body: string } | null;
  challenge: { id: string; body: string } | null;
  milestone: { message: string } | null;
  showTeamTab: boolean;
  personalBest: boolean;
  showLeaderboardAvatar: boolean;
  podium: LeaderboardRow[];
  rows: LeaderboardRow[];
  entries: LeaderboardRow[];
  me: LeaderboardRow;
};

export type HallOfFamePayload = {
  bestMonth: { agentName: string; month: string; totalNr: number; masked: boolean } | null;
  mostDeals: { agentName: string; month: string; dealsClosed: number; masked: boolean } | null;
  longestStreak: { agentName: string; days: number; masked: boolean } | null;
  mostConsistent: { agentName: string; months: number; masked: boolean } | null;
};

export type TeamCard = {
  managerId: string;
  managerName: string;
  totalNr: number;
  teamTarget: number;
  achievementPercent: number;
  membersAboveTarget: number;
  memberCount: number;
  topPerformerName: string | null;
  topPerformerNr: number | null;
};

function path(period: LeaderboardPeriod, scope: LeaderboardScope, refresh = false) {
  const params = new URLSearchParams({ period, scope });
  if (refresh) params.set("refresh", "true");
  return `/api/leaderboard?${params.toString()}`;
}

export function useLeaderboard(period: LeaderboardPeriod, scope: LeaderboardScope, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["leaderboard", period, scope],
    queryFn: () => apiGet<LeaderboardPayload>(path(period, scope)),
    enabled,
    meta: SILENT_QUERY_ERROR_META,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
  });

  async function refresh() {
    return queryClient.fetchQuery({
      queryKey: ["leaderboard", period, scope],
      queryFn: () => apiGet<LeaderboardPayload>(path(period, scope, true)),
    });
  }

  return { ...query, refresh };
}

export function useHallOfFame(enabled: boolean) {
  return useQuery({
    queryKey: ["leaderboard", "hall-of-fame"],
    queryFn: () => apiGet<HallOfFamePayload>("/api/leaderboard/hall-of-fame"),
    enabled,
    meta: SILENT_QUERY_ERROR_META,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useLeaderboardTeams(period: LeaderboardPeriod, enabled: boolean) {
  return useQuery({
    queryKey: ["leaderboard", "teams", period],
    queryFn: () =>
      apiGet<{ teams: TeamCard[]; myTeam: LeaderboardRow[] }>(
        `/api/leaderboard/teams?period=${period}&scope=all`,
      ),
    enabled,
    meta: SILENT_QUERY_ERROR_META,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePinLeaderboardBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: "announcement" | "challenge"; body: string }) =>
      apiPost("/api/leaderboard/announcements", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useLeaderboardAvatar() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<{ showLeaderboardAvatar?: boolean }>("/api/auth/me"),
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useSetLeaderboardAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (show: boolean) =>
      apiPatch<{ showLeaderboardAvatar: boolean }>("/api/leaderboard/avatar", { show }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function downloadLeaderboard(
  period: LeaderboardPeriod,
  scope: LeaderboardScope,
  format: "xls" | "pdf",
) {
  const params = new URLSearchParams({ period, scope, format });
  return apiDownload(`/api/leaderboard/export?${params.toString()}`, `leaderboard.${format}`);
}
