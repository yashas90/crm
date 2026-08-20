import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import { formatVisitTimeIst } from "@propninja/types/ist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SiteVisitStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type SiteVisitOutcome =
  | "very_interested"
  | "needs_time"
  | "not_interested"
  | "revisit_required"
  | null;

export type SiteVisit = {
  id: string;
  leadId: string;
  projectId: string | null;
  unitId?: string | null;
  tower?: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  status: SiteVisitStatus;
  notes: string | null;
  propertyAddress: string | null;
  meetingLocation?: string | null;
  mapsLink?: string | null;
  customerEmail?: string | null;
  propertyLabel: string | null;
  outcome?: SiteVisitOutcome;
  outcomeNote?: string | null;
  reminderSent?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lead: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  project: { id: string; name: string } | null;
  unit?: { id: string; unitNumber: string } | null;
  agent: { id: string; name: string; phone?: string | null } | null;
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

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated";
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function useSiteVisits(params: SiteVisitsListParams = {}, enabled = true) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["site-visits", "list", params],
    queryFn: () =>
      apiGet<{ items: SiteVisit[]; total: number; page: number; pageSize: number }>(
        `/api/site-visits${buildQuery(params)}`,
      ),
    enabled: ready && enabled,
    staleTime: 30_000,
    meta: { suppressErrorToast: true },
  });
}

export function useTodaySiteVisits(agentId?: string, options?: { enabled?: boolean }) {
  const ready = useAuthReady();
  const qs = agentId ? `?agentId=${agentId}` : "";
  return useQuery({
    queryKey: ["site-visits", "today", agentId ?? "all"],
    queryFn: () => apiGet<{ items: SiteVisit[]; total: number }>(`/api/site-visits/today${qs}`),
    enabled: (options?.enabled ?? true) && ready,
    staleTime: 30_000,
    meta: { suppressErrorToast: true },
  });
}

export function useSiteVisitsCalendar(dateFrom: string, dateTo: string, agentId?: string) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["site-visits", "calendar", dateFrom, dateTo, agentId ?? "all"],
    queryFn: () =>
      apiGet<{ dates: Record<string, SiteVisit[]>; total: number }>(
        `/api/site-visits/calendar${buildQuery({ dateFrom, dateTo, agentId })}`,
      ),
    enabled: ready && Boolean(dateFrom && dateTo),
    staleTime: 30_000,
    meta: { suppressErrorToast: true },
  });
}

export function useSiteVisit(id: string) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["site-visit", id],
    queryFn: () => apiGet<SiteVisit>(`/api/site-visits/${id}`),
    enabled: ready && Boolean(id),
  });
}

export function useLeadSiteVisits(leadId: string) {
  return useSiteVisits({ leadId, pageSize: 50 }, Boolean(leadId));
}

export function useCreateSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
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
    }) => apiPost<SiteVisit>("/api/site-visits", input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["site-visits"] }),
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
    },
  });
}

export function useCancelSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<SiteVisit>(`/api/site-visits/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["site-visits"] }),
  });
}

export function visitStatusColor(status: SiteVisitStatus): string {
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

export function visitStatusLabel(status: SiteVisitStatus): string {
  return status.replace(/_/g, " ");
}

export function formatVisitTime(visitTime: string) {
  return formatVisitTimeIst(visitTime);
}

export function agentColor(name: string) {
  const palette = ["#0d9488", "#204060", "#7c3aed", "#db2777", "#ea580c", "#0891b2"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function visitLeadName(visit: SiteVisit): string {
  if (visit.lead) {
    return `${visit.lead.firstName} ${visit.lead.lastName}`.trim() || "Lead";
  }
  return "Lead";
}

export function visitLocation(visit: SiteVisit): string {
  return visit.propertyLabel ?? visit.propertyAddress ?? visit.project?.name ?? "Property TBD";
}
