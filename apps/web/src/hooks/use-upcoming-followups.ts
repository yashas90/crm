"use client";

import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export type FollowupReminderType = "callback" | "meeting" | "site_visit";

export type UpcomingFollowup = {
  id: string;
  leadName: string;
  nextFollowupAt: string;
  type: FollowupReminderType;
  status: string;
};

export function useUpcomingFollowups(days = 14, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leads", "followups", "upcoming", days],
    queryFn: () => apiGet<UpcomingFollowup[]>(`/api/leads/followups/upcoming?days=${days}`),
    enabled: options?.enabled ?? true,
  });
}
