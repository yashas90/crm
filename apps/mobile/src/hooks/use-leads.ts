import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { todayRange } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIVE_REFETCH_MS = 30_000;
const LEADS_PAGE_SIZE = "50";

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
  score?: number;
};

export type LeadActivity = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
};

export type LeadDetail = LeadRow & {
  state: string | null;
  leadSource: string | null;
  secondaryPhone?: string | null;
  tags?: string[] | null;
  lastContactedAt: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  activities?: LeadActivity[];
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
  excludeDuplicates?: string;
};

export type { LeadsQuery };

function buildLeadsParams(query: LeadsQuery, page: number | string) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: query.pageSize ?? LEADS_PAGE_SIZE,
    excludeDuplicates: query.excludeDuplicates ?? "true",
  });
  if (query.assignedTo) params.set("assignedTo", query.assignedTo);
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.temperature) params.set("temperature", query.temperature);
  return params;
}

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
}

export function useLeads(query: LeadsQuery = {}) {
  const ready = useAuthReady();
  const params = buildLeadsParams(query, query.page ?? "1");

  return useQuery({
    queryKey: ["leads", params.toString()],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${params.toString()}`,
      ),
    enabled: ready,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useInfiniteLeads(query: Omit<LeadsQuery, "page"> = {}) {
  const ready = useAuthReady();
  const baseParams = buildLeadsParams(query, 1);
  baseParams.delete("page");

  return useInfiniteQuery({
    queryKey: ["leads", "infinite", baseParams.toString()],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = buildLeadsParams(query, pageParam);
      return apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${params.toString()}`,
      );
    },
    getNextPageParam: (lastPage) => {
      const totalPages = Math.max(1, Math.ceil(lastPage.total / lastPage.pageSize));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: ready,
    refetchInterval: LIVE_REFETCH_MS,
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
    excludeDuplicates: "true",
  });
  if (userId) params.set("assignedTo", userId);

  return useQuery({
    queryKey: ["leads", "queue", userId, dateTo],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${params.toString()}`,
      ),
    enabled: ready,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useLead(leadId: string) {
  const ready = useAuthReady();

  return useQuery({
    queryKey: ["leads", leadId],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${leadId}`),
    enabled: ready && Boolean(leadId),
    refetchInterval: LIVE_REFETCH_MS,
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

export function useUpdateLeadFollowUp(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { nextFollowupAt: string; markComplete?: boolean }) =>
      apiPatch(`/api/leads/${leadId}/follow-up`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
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
    refetchInterval: LIVE_REFETCH_MS,
  });
}
