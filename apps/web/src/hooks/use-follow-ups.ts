"use client";

import { apiGet, apiPatch } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OverdueLead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
  coldSince: string | null;
  followUpCount: number;
  createdAt: string;
  daysOverdue: number;
  daysSinceContact: number;
  assignedUser: { id: string; name: string } | null;
};

export type ColdLead = OverdueLead;

export function useOverdueLeads() {
  return useQuery({
    queryKey: ["leads", "overdue"],
    queryFn: () => apiGet<{ items: OverdueLead[]; total: number }>("/api/leads/overdue"),
  });
}

export function useColdLeads() {
  return useQuery({
    queryKey: ["leads", "cold"],
    queryFn: () => apiGet<{ items: ColdLead[]; total: number }>("/api/leads/cold"),
  });
}

export function useUpdateLeadFollowUp(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nextFollowupAt: string; markComplete?: boolean }) =>
      apiPatch(`/api/leads/${leadId}/follow-up`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
    },
  });
}

export function useLeadFollowUpHistory(leadId: string) {
  return useQuery({
    queryKey: ["leads", leadId, "follow-up-history"],
    queryFn: async () => {
      const lead = await apiGet<{
        activities: Array<{
          id: string;
          type: string;
          metadata: Record<string, unknown> | null;
          createdAt: string;
          userName: string | null;
        }>;
      }>(`/api/leads/${leadId}`);
      return (lead.activities ?? []).filter((a) => a.type === "follow_up");
    },
    enabled: Boolean(leadId),
  });
}
