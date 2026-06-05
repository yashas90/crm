"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeadsListData = {
  items: LeadRow[];
  page: number;
  pageSize: number;
  total: number;
};

export type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  secondaryPhone?: string | null;
  city: string | null;
  leadStatus: string;
  temperature: string | null;
  leadSource: string | null;
  projectName?: string | null;
  estimatedValue?: string | null;
  lastContactedAt: string | null;
  nextFollowupAt?: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  createdAt: string;
};

export type LeadDetail = LeadRow & {
  notes: string | null;
  state: string | null;
  tags?: string[] | null;
  activities: LeadActivity[];
  leadSummary?: {
    firstSeenAt: string;
    firstCallAt: string | null;
    totalCalls: number;
    completedCalls: number;
    missedCalls: number;
    daysToFirstCall?: number;
    currentStage: string;
  };
};

export type LeadActivity = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName?: string | null;
};

export type CallRecord = {
  id: string;
  phoneNumber: string;
  direction: string;
  status: string;
  durationSeconds: number;
  startedAt: string;
  disposition: string | null;
  notes: string | null;
  userName?: string | null;
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
};

export type LeadsQueryParams = {
  search?: string;
  status?: string;
  temperature?: string;
  assignedTo?: string;
  followUpDueBefore?: string;
  orderByFollowUp?: string;
  page?: string;
  pageSize?: string;
};

export type CallsQueryParams = {
  lead_id?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: string;
  pageSize?: string;
};

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function useLeads(params: LeadsQueryParams) {
  const query = buildQuery(params);

  return useQuery({
    queryKey: ["leads", query],
    queryFn: () => apiGet<LeadsListData>(`/api/leads${query}`),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["leads", id],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${id}`),
    enabled: Boolean(id),
  });
}

// Read-only on web: lists call records for lead detail and reports. Logging happens on mobile.
export function useCalls(params: CallsQueryParams) {
  const query = buildQuery(params);
  const hasFilter = Boolean(params.lead_id || params.user_id || params.date_from || params.date_to);

  return useQuery({
    queryKey: ["calls", query],
    queryFn: () =>
      apiGet<{ items: CallRecord[]; page: number; pageSize: number; total: number }>(
        `/api/calls${query}`,
      ),
    enabled: hasFilter,
  });
}

export function useUpdateLead(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPatch(`/api/leads/${leadId}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadId: string) => apiDelete(`/api/leads/${leadId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useAddLeadNote(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => apiPost(`/api/leads/${leadId}/notes`, { text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
    },
  });
}

/** Build API query params for follow-up filter chips. */
export function followUpQueryParams(filter: "" | "due_today" | "overdue" | "upcoming") {
  if (!filter) return {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (filter === "due_today") {
    return { followUpDueBefore: end.toISOString(), orderByFollowUp: "true" };
  }
  if (filter === "overdue") {
    return {
      followUpDueBefore: new Date(start.getTime() - 1).toISOString(),
      orderByFollowUp: "true",
    };
  }
  // Upcoming: fetch ordered queue for next 30 days; page filters to after today.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  return { followUpDueBefore: horizon.toISOString(), orderByFollowUp: "true" };
}

export function filterUpcomingLeads(items: LeadRow[]) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return items.filter((lead) => lead.nextFollowupAt && new Date(lead.nextFollowupAt) > end);
}
