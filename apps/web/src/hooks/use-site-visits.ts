"use client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { formatVisitTimeIst } from "@propninja/types/ist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SiteVisitStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type SiteVisit = {
  id: string;
  leadId: string;
  projectId: string | null;
  unitId: string | null;
  tower: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  status: SiteVisitStatus;
  notes: string | null;
  propertyAddress: string | null;
  meetingLocation: string | null;
  mapsLink: string | null;
  customerEmail: string | null;
  publicToken: string;
  googleCalendarEventId: string | null;
  propertyLabel: string | null;
  reminderSent: boolean;
  remindersSent: Array<{ tierMinutes: number; sentAt: string }>;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email?: string | null;
  } | null;
  project: { id: string; name: string } | null;
  unit: { id: string; unitNumber: string } | null;
  agent: { id: string; name: string; phone?: string | null } | null;
};

export type SiteVisitDashboardSummary = {
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  missed: number;
};

export type SiteVisitsListParams = {
  agentId?: string;
  leadId?: string;
  projectId?: string;
  status?: SiteVisitStatus;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function siteVisitsQueryKey(params?: SiteVisitsListParams) {
  return ["site-visits", params ?? {}] as const;
}

export function useSiteVisits(params: SiteVisitsListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: siteVisitsQueryKey(params),
    queryFn: () =>
      apiGet<{ items: SiteVisit[]; total: number; page: number; pageSize: number }>(
        `/api/site-visits${buildQuery(params)}`,
      ),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useTodaySiteVisits(agentId?: string) {
  const qs = agentId ? `?agentId=${agentId}` : "";
  return useQuery({
    queryKey: ["site-visits", "today", agentId ?? "all"],
    queryFn: () => apiGet<{ items: SiteVisit[]; total: number }>(`/api/site-visits/today${qs}`),
    staleTime: 30_000,
  });
}

export function useSiteVisitsCalendar(dateFrom: string, dateTo: string, agentId?: string) {
  return useQuery({
    queryKey: ["site-visits", "calendar", dateFrom, dateTo, agentId ?? "all"],
    queryFn: () =>
      apiGet<{ dates: Record<string, SiteVisit[]>; total: number }>(
        `/api/site-visits/calendar${buildQuery({ dateFrom, dateTo, agentId })}`,
      ),
    enabled: Boolean(dateFrom && dateTo),
    staleTime: 30_000,
  });
}

export function useSiteVisit(id: string) {
  return useQuery({
    queryKey: ["site-visit", id],
    queryFn: () => apiGet<SiteVisit>(`/api/site-visits/${id}`),
    enabled: Boolean(id),
  });
}

export type CreateSiteVisitInput = {
  leadId: string;
  projectId?: string | null;
  unitId?: string | null;
  tower?: string | null;
  agentId?: string;
  visitDate: string;
  visitTime: string;
  duration?: number;
  notes?: string | null;
  propertyAddress?: string | null;
  meetingLocation?: string | null;
  mapsLink?: string | null;
  customerEmail?: string | null;
};

export function useSiteVisitSummary(agentId?: string) {
  const qs = agentId ? `?agentId=${agentId}` : "";
  return useQuery({
    queryKey: ["site-visits", "summary", agentId ?? "all"],
    queryFn: () => apiGet<SiteVisitDashboardSummary>(`/api/site-visits/summary${qs}`),
    staleTime: 30_000,
  });
}

export function useCreateSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSiteVisitInput) => apiPost<SiteVisit>("/api/site-visits", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits"] });
      toast.success("Site visit scheduled");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to schedule visit"),
  });
}

export function useUpdateSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiPatch<SiteVisit>(`/api/site-visits/${id}`, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits"] });
      void queryClient.invalidateQueries({ queryKey: ["site-visit", variables.id] });
      toast.success("Visit updated");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update visit"),
  });
}

export function useCancelSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<SiteVisit>(`/api/site-visits/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-visits"] });
      toast.success("Visit cancelled");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to cancel visit"),
  });
}

export function visitStatusColor(status: SiteVisitStatus) {
  switch (status) {
    case "scheduled":
      return "#16a34a";
    case "completed":
      return "#204060";
    case "cancelled":
      return "#dc2626";
    case "no_show":
      return "#ea580c";
    default:
      return "#64748b";
  }
}

export function visitLeadName(visit: SiteVisit) {
  if (visit.lead) {
    return `${visit.lead.firstName} ${visit.lead.lastName}`.trim() || "Lead";
  }
  return "Lead";
}

export function formatVisitTime(visitTime: string) {
  return formatVisitTimeIst(visitTime);
}
