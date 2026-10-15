"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MorningCallback = {
  id: string;
  source: "lead" | "calling";
  name: string;
  phone: string | null;
  at: string;
  leadId: string | null;
};

export type MorningBrief = {
  greeting: string;
  name: string;
  date: string;
  trackingStatus: {
    on: boolean;
    label: "On" | "Off";
    health: string | null;
    agentStatus: string | null;
    lastSeenAt: string | null;
  };
  quoteOfDay: { text: string; dayOfYear: number };
  target: {
    amount: number;
    amountLabel: string;
    achieved: number;
    achievedLabel: string;
    dailyNeeded: number;
    dailyNeededLabel: string;
    daysRemaining: number;
    percent: number;
    unlocked: boolean;
    aboveTargetPercent: number;
    band: string | null;
    source: "incentive" | "agent_target" | "none";
  };
  teamTarget: {
    memberCount: number;
    target: number;
    targetLabel: string;
    achieved: number;
    achievedLabel: string;
    aboveTargetCount: number;
  } | null;
  callbacks: { overdue: MorningCallback[]; today: MorningCallback[]; count: number };
  leaderboard: {
    rank: number;
    previousRank: number | null;
    trend: "up" | "down" | "flat";
    nameAbove: string | null;
    neighborBelow: { name: string; rank: number } | null;
    gapToNext: number;
    gapToNextLabel: string;
  };
  callingData: {
    pending: number;
    calledToday: number;
    interestedToday: number;
    remaining: number;
  };
  leads: {
    hot: number;
    warm: number;
    cold: number;
    siteVisit: number;
    negotiation: number;
    urgent: number;
  };
  teamFeed: {
    items: {
      id: string;
      kind: "deal" | "announcement" | "badge";
      title: string;
      body: string;
      at: string;
      reactions: number;
    }[];
    viewAll: { label: string; surface: "whatsapp" | "announcements"; webPath: string };
  };
  schedule: {
    items: {
      id: string;
      time: string;
      timeLabel: string;
      leadName: string;
      projectName: string | null;
      status: string;
      agentName: string | null;
    }[];
  };
  appraisal: {
    quarter: string;
    quarterLabel: string;
    mapped: boolean;
    sales: number;
    units: number;
    minSales: number | null;
    minUnits: number | null;
    hikePercent: number;
    eligible: boolean;
    hikeAmount: number;
    hikeAmountLabel: string;
  };
};

export function useMorningBrief(enabled = true) {
  return useQuery({
    queryKey: ["morning-brief"],
    queryFn: () => apiGet<MorningBrief>("/api/dashboard/morning-brief"),
    enabled,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useCompleteMorningCallback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { source: "lead" | "calling"; id: string }) =>
      apiPost<{ done: boolean }>("/api/dashboard/morning-brief/callbacks/complete", input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["morning-brief"] });
    },
  });
}
