"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import type { LeadScopeCounts } from "@/lib/leads-scope";
import { toast } from "@/lib/toast";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  projectId?: string | null;
  estimatedValue?: string | null;
  lastContactedAt: string | null;
  nextFollowupAt?: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  tags?: string[] | null;
  customFields?: Record<string, unknown> | null;
  createdAt: string;
};

export type LeadDetail = LeadRow & {
  notes: string | null;
  state: string | null;
  tags?: string[] | null;
  score?: number;
  followUpCount?: number;
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

export type LeadAssignment = {
  id: string;
  leadId: string;
  fromAgentId: string | null;
  fromAgentName: string | null;
  toAgentId: string;
  toAgentName: string;
  assignedBy: string;
  assignedByName: string;
  reason: string | null;
  assignedAt: string;
};

export type CallRecord = {
  id: string;
  phoneNumber: string;
  direction: string;
  status: string;
  durationSeconds: number;
  startedAt: string;
  disposition: string | null;
  outcome: string | null;
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
  source?: string;
  adLeads?: string;
  tags?: string;
  dateFrom?: string;
  dateTo?: string;
  unassigned?: string;
  teamLeads?: string;
  duplicatesOnly?: string;
  excludeDuplicates?: string;
  reEnquiredOnly?: string;
  activeOnly?: string;
  deletedOnly?: string;
  followUpDueBefore?: string;
  followUpDueAfter?: string;
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

/** Stable query key — only changes when filter values change. */
export function leadsListQueryKey(params: LeadsQueryParams) {
  return [
    "leads",
    "list",
    params.search ?? null,
    params.status ?? null,
    params.temperature ?? null,
    params.assignedTo ?? null,
    params.source ?? null,
    params.adLeads ?? null,
    params.tags ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.unassigned ?? null,
    params.teamLeads ?? null,
    params.duplicatesOnly ?? null,
    params.excludeDuplicates ?? null,
    params.reEnquiredOnly ?? null,
    params.activeOnly ?? null,
    params.deletedOnly ?? null,
    params.followUpDueBefore ?? null,
    params.followUpDueAfter ?? null,
    params.orderByFollowUp ?? null,
    params.page ?? "1",
    params.pageSize ?? "10",
  ] as const;
}

function sharedCountsQueryKey(
  prefix: "scope-counts" | "stage-counts",
  params: Record<string, string | undefined>,
) {
  return [
    "leads",
    prefix,
    params.search ?? null,
    params.temperature ?? null,
    params.source ?? null,
    params.adLeads ?? null,
    params.tags ?? null,
    params.dateFrom ?? null,
    params.dateTo ?? null,
    params.assignedTo ?? null,
    params.unassigned ?? null,
    params.teamLeads ?? null,
    params.duplicatesOnly ?? null,
    params.excludeDuplicates ?? null,
    params.deletedOnly ?? null,
  ] as const;
}

export type LeadStageCounts = {
  active: number;
  new: number;
  pending: number;
  scheduled: number;
  overdue: number;
  eoi: number;
};

export type { LeadScopeCounts } from "@/lib/leads-scope";

export function useLeadScopeCounts(
  params: Omit<
    LeadsQueryParams,
    | "status"
    | "activeOnly"
    | "followUpDueBefore"
    | "followUpDueAfter"
    | "orderByFollowUp"
    | "assignedTo"
    | "unassigned"
    | "deletedOnly"
    | "page"
    | "pageSize"
  >,
  options?: { enabled?: boolean },
) {
  const query = buildQuery(params);

  return useQuery({
    queryKey: sharedCountsQueryKey("scope-counts", params),
    queryFn: () => apiGet<LeadScopeCounts>(`/api/leads/scope-counts${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useLeadStageCounts(
  params: Omit<
    LeadsQueryParams,
    | "status"
    | "activeOnly"
    | "followUpDueBefore"
    | "followUpDueAfter"
    | "orderByFollowUp"
    | "page"
    | "pageSize"
  >,
  options?: { enabled?: boolean },
) {
  const query = buildQuery(params);

  return useQuery({
    queryKey: sharedCountsQueryKey("stage-counts", params),
    queryFn: () => apiGet<LeadStageCounts>(`/api/leads/stage-counts${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useLeads(
  params: LeadsQueryParams,
  options?: { enabled?: boolean; suppressErrorToast?: boolean },
) {
  const query = buildQuery(params);

  return useQuery({
    queryKey: leadsListQueryKey(params),
    queryFn: () => apiGet<LeadsListData>(`/api/leads${query}`),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    meta: options?.suppressErrorToast ? { suppressErrorToast: true } : undefined,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["leads", id],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${id}`),
    enabled: Boolean(id),
  });
}

// Call records for lead detail and reports. Web can log via POST /api/calls/log.
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

export type LogCallInput = {
  lead_id: string;
  phone_number: string;
  duration: number;
  outcome: "answered" | "no_answer" | "busy" | "left_voicemail";
  notes?: string;
  source: "web-manual";
};

export function useLogCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LogCallInput) => apiPost("/api/calls/log", payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["calls"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", variables.lead_id] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadId: string) => apiDelete(`/api/leads/${leadId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead archived");
    },
  });
}

export function useAddLeadNote(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => apiPost(`/api/leads/${leadId}/notes`, { text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
      toast.success("Note saved");
    },
  });
}

export function useLeadAssignments(leadId: string) {
  return useQuery({
    queryKey: ["leads", leadId, "assignments"],
    queryFn: () => apiGet<{ items: LeadAssignment[] }>(`/api/leads/${leadId}/assignments`),
    enabled: Boolean(leadId),
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
