"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { HOT_LEAD_SCORE_THRESHOLD, WARM_LEAD_SCORE_THRESHOLD } from "@/lib/lead-scoring-constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeadScoringConfig = {
  enabled: boolean;
  rules: Record<string, number>;
  ruleLabels: { key: string; label: string }[];
  hotThreshold: number;
  warmThreshold: number;
  recalculateIntervalHours: number;
};

export type LeadScoringStats = {
  enabled: boolean;
  totalScored: number;
  hot: number;
  warm: number;
  cold: number;
};

export type LeadScoreBreakdown = {
  enabled: boolean;
  score: number;
  factors: { label: string; points: number }[];
};

export function useLeadScoringConfig() {
  return useQuery({
    queryKey: ["lead-scoring", "config"],
    queryFn: () => apiGet<LeadScoringConfig>("/api/leads/scoring/config"),
    staleTime: 60_000,
  });
}

export function useLeadScoringStats() {
  return useQuery({
    queryKey: ["lead-scoring", "stats"],
    queryFn: () => apiGet<LeadScoringStats>("/api/leads/scoring/stats"),
    staleTime: 30_000,
  });
}

export function useLeadScore(leadId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["lead-score", leadId],
    queryFn: () => apiGet<LeadScoreBreakdown>(`/api/leads/${leadId}/score`),
    enabled: Boolean(leadId) && options?.enabled !== false,
    staleTime: 30_000,
    meta: { errorContext: "lead score", suppressErrorToast: true },
  });
}

export function useRecalculateLeadScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiPost<{ updated: number; checked: number; skipped?: boolean }>(
        "/api/leads/scoring/recalculate",
        {},
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lead-scoring"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["lead-score"] });
    },
  });
}

export { HOT_LEAD_SCORE_THRESHOLD, WARM_LEAD_SCORE_THRESHOLD };
