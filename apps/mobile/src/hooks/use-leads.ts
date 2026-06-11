import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { todayRange } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  leadStatus: string;
  temperature: string | null;
  email: string | null;
  city: string | null;
  projectName?: string | null;
  notes: string | null;
  nextFollowupAt: string | null;
  lastContactedAt?: string | null;
};

export type LeadDetail = LeadRow & {
  state: string | null;
  leadSource: string | null;
  secondaryPhone?: string | null;
  tags?: string[] | null;
  lastContactedAt: string | null;
  leadSummary?: {
    totalCalls: number;
    completedCalls: number;
    missedCalls: number;
    firstCallAt: string | null;
    firstSeenAt: string;
    daysToFirstCall?: number;
    currentStage: string;
  };
};

type LeadsQuery = {
  search?: string;
  status?: string;
  temperature?: string;
  assignedTo?: string;
  page?: string;
  pageSize?: string;
};

export type { LeadsQuery };

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
}

export function useLeads(query: LeadsQuery = {}) {
  const ready = useAuthReady();
  const params = new URLSearchParams({
    page: query.page ?? "1",
    pageSize: query.pageSize ?? "100",
  });
  if (query.assignedTo) params.set("assignedTo", query.assignedTo);
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.temperature) params.set("temperature", query.temperature);

  return useQuery({
    queryKey: ["leads", params.toString()],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${params.toString()}`,
      ),
    enabled: ready,
  });
}

export function useTodayQueue() {
  const ready = useAuthReady();
  const userId = getCurrentUserId();
  const { dateTo } = todayRange();
  const params = new URLSearchParams({
    followUpDueBefore: dateTo,
    orderByFollowUp: "true",
    page: "1",
    pageSize: "100",
  });
  if (userId) params.set("assignedTo", userId);

  return useQuery({
    queryKey: ["leads", "queue", userId, dateTo],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${params.toString()}`,
      ),
    enabled: ready,
    refetchInterval: 60_000,
  });
}

export function useLead(leadId: string) {
  const ready = useAuthReady();

  return useQuery({
    queryKey: ["leads", leadId],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${leadId}`),
    enabled: ready && Boolean(leadId),
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

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: Record<string, unknown> }) =>
      apiPatch(`/api/leads/${leadId}`, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", variables.leadId] });
    },
  });
}

export function useLeadScopeCounts() {
  const ready = useAuthReady();

  return useQuery({
    queryKey: ["leads", "scope-counts"],
    queryFn: () =>
      apiGet<{
        all: number;
        my: number;
        teams: number;
        unassigned: number;
      }>("/api/leads/scope-counts"),
    enabled: ready,
    staleTime: 30_000,
  });
}
