import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { liveQueryOptions } from "@/lib/liveQuery";
import { useAuth } from "@/providers/auth-provider";
import { formatVisitTimeIst } from "@propninja/types/ist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const live = liveQueryOptions();

export type SiteVisitStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type SiteVisit = {
  id: string;
  leadId: string;
  projectId: string | null;
  agentId: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  status: SiteVisitStatus;
  notes: string | null;
  propertyAddress: string | null;
  propertyLabel: string | null;
  lead: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  project: { id: string; name: string } | null;
  agent: { id: string; name: string } | null;
};

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated";
}

export function useTodaySiteVisits() {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["site-visits", "today"],
    queryFn: () => apiGet<{ items: SiteVisit[]; total: number }>("/api/site-visits/today"),
    enabled: ready,
    ...live,
  });
}

export function useSiteVisitsCalendar(dateFrom: string, dateTo: string, agentId?: string) {
  const ready = useAuthReady();
  const params = new URLSearchParams({ dateFrom, dateTo });
  if (agentId) params.set("agentId", agentId);

  return useQuery({
    queryKey: ["site-visits", "calendar", dateFrom, dateTo, agentId ?? "all"],
    queryFn: () =>
      apiGet<{ dates: Record<string, SiteVisit[]>; total: number }>(
        `/api/site-visits/calendar?${params.toString()}`,
      ),
    enabled: ready && Boolean(dateFrom && dateTo),
    staleTime: 30_000,
  });
}

export function useLeadSiteVisits(leadId: string) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["site-visits", "lead", leadId],
    queryFn: () =>
      apiGet<{ items: SiteVisit[]; total: number }>(
        `/api/site-visits?leadId=${leadId}&pageSize=50`,
      ),
    enabled: ready && Boolean(leadId),
  });
}

export function useCreateSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      leadId: string;
      projectId?: string | null;
      agentId?: string;
      visitDate: string;
      visitTime: string;
      duration?: number;
      notes?: string | null;
      propertyAddress?: string | null;
    }) => apiPost<SiteVisit>("/api/site-visits", input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["site-visits"] }),
  });
}

export function useUpdateSiteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiPatch<SiteVisit>(`/api/site-visits/${id}`, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["site-visits"] }),
  });
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
