import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { getCurrentUserId, getUser, normalizeRole } from "@/lib/auth";
import { todayRange } from "@/lib/dates";
import { cancelFollowUpReminder, scheduleFollowUpReminder } from "@/lib/followUpLocalReminders";
import { isNaLeadStatus } from "@/lib/lead-status-options";
import { useAuth } from "@/providers/auth-provider";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

const LEAD_STALE_MS = 30_000;
/** Lead detail must not be always-stale — dialer return marks RQ focused and would refetch mid post-call UI. */
const LEAD_DETAIL_STALE_MS = 30_000;

const LEADS_PAGE_SIZE = "50";

export type LeadRow = {
  id: string;
  leadCode: string;
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
  estimatedValue?: string | null;
  score?: number;
  leadSource?: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
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
  adAttribution?: {
    campaignName: string | null;
    adsetName: string | null;
    adName: string | null;
    formName: string | null;
    pageName: string | null;
  } | null;
};

type LeadsQuery = {
  search?: string;
  status?: string;
  temperature?: string;
  source?: string;
  assignedTo?: string;
  unassigned?: string;
  teamLeads?: string;
  assignWithHistory?: string;
  assignedFrom?: string;
  assignedBy?: string;
  originalOwner?: string;
  subStatus?: string;
  subSource?: string;
  tagPresets?: string;
  meetingDone?: string;
  meetingNotDone?: string;
  siteVisitDone?: string;
  siteVisitNotDone?: string;
  projectStatus?: string;
  projectId?: string;
  hasProject?: string;
  possessionFrom?: string;
  possessionTo?: string;
  city?: string;
  state?: string;
  locality?: string;
  country?: string;
  zone?: string;
  latitude?: string;
  longitude?: string;
  radiusKm?: string;
  countryCode?: string;
  altCountryCode?: string;
  customerCountry?: string;
  propertyStatus?: string;
  propertyType?: string;
  propertySubType?: string;
  bhk?: string;
  bhkType?: string;
  minBudgetFrom?: string;
  minBudgetTo?: string;
  maxBudgetFrom?: string;
  maxBudgetTo?: string;
  carpetAreaFrom?: string;
  carpetAreaTo?: string;
  builtUpAreaFrom?: string;
  builtUpAreaTo?: string;
  followUpDueBefore?: string;
  followUpDueAfter?: string;
  activeOnly?: string;
  excludeNew?: string;
  orderByFollowUp?: string;
  page?: string;
  pageSize?: string;
  excludeDuplicates?: string;
};

export type { LeadsQuery };

const QUERY_KEYS: (keyof LeadsQuery)[] = [
  "search",
  "status",
  "temperature",
  "source",
  "assignedTo",
  "unassigned",
  "teamLeads",
  "assignWithHistory",
  "assignedFrom",
  "assignedBy",
  "originalOwner",
  "subStatus",
  "subSource",
  "tagPresets",
  "meetingDone",
  "meetingNotDone",
  "siteVisitDone",
  "siteVisitNotDone",
  "projectStatus",
  "projectId",
  "hasProject",
  "possessionFrom",
  "possessionTo",
  "city",
  "state",
  "locality",
  "country",
  "zone",
  "latitude",
  "longitude",
  "radiusKm",
  "countryCode",
  "altCountryCode",
  "customerCountry",
  "propertyStatus",
  "propertyType",
  "propertySubType",
  "bhk",
  "bhkType",
  "minBudgetFrom",
  "minBudgetTo",
  "maxBudgetFrom",
  "maxBudgetTo",
  "carpetAreaFrom",
  "carpetAreaTo",
  "builtUpAreaFrom",
  "builtUpAreaTo",
  "followUpDueBefore",
  "followUpDueAfter",
  "activeOnly",
  "excludeNew",
  "orderByFollowUp",
];

function applyAgentLeadScope(query: LeadsQuery): LeadsQuery {
  const role = normalizeRole(getUser()?.role ?? "agent");
  if (role !== "agent") return query;

  const userId = getCurrentUserId();
  const next: LeadsQuery = { ...query };
  next.unassigned = undefined;
  next.teamLeads = undefined;
  next.assignWithHistory = undefined;
  if (userId) next.assignedTo = userId;
  return next;
}

function buildLeadsParams(query: LeadsQuery, page: number | string) {
  const scoped = applyAgentLeadScope(query);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: scoped.pageSize ?? LEADS_PAGE_SIZE,
    excludeDuplicates: scoped.excludeDuplicates ?? "true",
  });
  for (const key of QUERY_KEYS) {
    const value = scoped[key];
    if (value) params.set(key, value);
  }
  return params;
}

function useAuthReady() {
  const { status, user } = useAuth();
  // Prefer React auth user — module cache can lag behind session restore.
  return status === "authenticated" && Boolean(user?.id || getCurrentUserId());
}

export function useLeads(query: LeadsQuery = {}, options?: { enabled?: boolean }) {
  const ready = useAuthReady();
  const params = buildLeadsParams(query, query.page ?? "1");

  return useQuery({
    queryKey: ["leads", params.toString()],
    queryFn: () =>
      apiGet<{ items: LeadRow[]; page: number; pageSize: number; total: number }>(
        `/api/leads?${params.toString()}`,
      ),
    enabled: ready && (options?.enabled ?? true),
    staleTime: LEAD_STALE_MS,
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
      if (
        !lastPage ||
        typeof lastPage.total !== "number" ||
        typeof lastPage.pageSize !== "number"
      ) {
        return undefined;
      }
      const pageSize = Math.max(1, lastPage.pageSize);
      const totalPages = Math.max(1, Math.ceil(lastPage.total / pageSize));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    enabled: ready,
    staleTime: LEAD_STALE_MS,
    placeholderData: keepPreviousData,
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
    staleTime: LEAD_STALE_MS,
  });
}

export function useLead(leadId: string, options?: { enabled?: boolean }) {
  const ready = useAuthReady();
  const enabled = (options?.enabled ?? true) && ready && Boolean(leadId);

  return useQuery({
    queryKey: ["leads", leadId],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${leadId}`),
    enabled,
    staleTime: LEAD_DETAIL_STALE_MS,
    // Dialer return sets RQ focused — do not refetch detail under the post-call modal.
    refetchOnWindowFocus: false,
    meta: { suppressErrorToast: true },
  });
}

export function useAddLeadNote(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => apiPost(`/api/leads/${leadId}/notes`, { text }),
    onSuccess: () => {
      // Don't await — Wi‑Fi refetches can hang and keep Save spinning.
      void queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
    },
  });
}

type InfiniteLeadsData = {
  pages: Array<{ items: LeadRow[]; page: number; pageSize: number; total: number }>;
  pageParams: unknown[];
};

function patchLeadInInfiniteCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  leadId: string,
  patch: Record<string, unknown>,
) {
  queryClient.setQueriesData<InfiniteLeadsData>({ queryKey: ["leads", "infinite"] }, (old) => {
    if (!old?.pages) return old;
    let changed = false;
    const pages = old.pages.map((page) => {
      if (!Array.isArray(page?.items)) return page;
      let pageChanged = false;
      const items = page.items.map((lead) => {
        if (lead.id !== leadId) return lead;
        pageChanged = true;
        changed = true;
        return { ...lead, ...patch } as LeadRow;
      });
      return pageChanged ? { ...page, items } : page;
    });
    return changed ? { ...old, pages } : old;
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: Record<string, unknown> }) =>
      apiPatch(`/api/leads/${leadId}`, payload),
    onMutate: async ({ leadId, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const previousInfinite = queryClient.getQueriesData<InfiniteLeadsData>({
        queryKey: ["leads", "infinite"],
      });
      const previousDetail = queryClient.getQueryData<LeadDetail>(["leads", leadId]);

      patchLeadInInfiniteCaches(queryClient, leadId, payload);
      if (previousDetail) {
        queryClient.setQueryData<LeadDetail>(["leads", leadId], {
          ...previousDetail,
          ...payload,
        } as LeadDetail);
      }

      return { previousInfinite, previousDetail, leadId };
    },
    onError: (_err, _variables, context) => {
      if (!context) return;
      for (const [key, data] of context.previousInfinite) {
        queryClient.setQueryData(key, data);
      }
      if (context.previousDetail) {
        queryClient.setQueryData(["leads", context.leadId], context.previousDetail);
      }
    },
    onSuccess: (_data, variables) => {
      if ("nextFollowupAt" in variables.payload) {
        const cached =
          queryClient.getQueryData<LeadRow>(["leads", variables.leadId]) ??
          queryClient.getQueryData<LeadDetail>(["leads", variables.leadId]);
        const leadName = cached
          ? `${cached.firstName} ${cached.lastName}`.trim()
          : "Lead follow-up";
        const next = variables.payload.nextFollowupAt;
        void scheduleFollowUpReminder({
          leadId: variables.leadId,
          leadName,
          nextFollowupAt: typeof next === "string" ? next : null,
        });
      }

      const status = variables.payload.leadStatus;
      const closedLead = typeof status === "string" && isNaLeadStatus(status);

      if (closedLead) {
        void cancelFollowUpReminder(variables.leadId);
        void queryClient.cancelQueries({ queryKey: ["leads", variables.leadId] });
        queryClient.removeQueries({ queryKey: ["leads", variables.leadId] });
        void queryClient.invalidateQueries({
          predicate: (query) => {
            if (query.queryKey[0] !== "leads") return false;
            if (query.queryKey[1] === variables.leadId) return false;
            return true;
          },
          refetchType: "active",
        });
        return;
      }

      // Background reconcile — UI already updated optimistically.
      void queryClient.invalidateQueries({ queryKey: ["leads"], refetchType: "active" });
    },
  });
}

export function useUpdateLeadFollowUp(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { nextFollowupAt: string; markComplete?: boolean }) =>
      apiPatch(`/api/leads/${leadId}/follow-up`, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] });
      const previousInfinite = queryClient.getQueriesData<InfiniteLeadsData>({
        queryKey: ["leads", "infinite"],
      });
      const previousDetail = queryClient.getQueryData<LeadDetail>(["leads", leadId]);
      patchLeadInInfiniteCaches(queryClient, leadId, { nextFollowupAt: payload.nextFollowupAt });
      if (previousDetail) {
        queryClient.setQueryData<LeadDetail>(["leads", leadId], {
          ...previousDetail,
          nextFollowupAt: payload.nextFollowupAt,
        });
      }
      return { previousInfinite, previousDetail };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      for (const [key, data] of context.previousInfinite) {
        queryClient.setQueryData(key, data);
      }
      if (context.previousDetail) {
        queryClient.setQueryData(["leads", leadId], context.previousDetail);
      }
    },
    onSuccess: (_data, variables) => {
      const cached =
        queryClient.getQueryData<LeadRow>(["leads", leadId]) ??
        queryClient.getQueryData<LeadDetail>(["leads", leadId]);
      const leadName = cached ? `${cached.firstName} ${cached.lastName}`.trim() : "Lead follow-up";
      void scheduleFollowUpReminder({
        leadId,
        leadName,
        nextFollowupAt: variables.nextFollowupAt,
      });
      void queryClient.invalidateQueries({ queryKey: ["leads"], refetchType: "active" });
      void queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" });
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
    staleTime: LEAD_STALE_MS,
  });
}

/** Lighter than scope-counts for the home "My leads" stat (single count query). */
export type HotLead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  score: number;
  temperature: string | null;
  nextFollowupAt: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
};

export function useHotLeads(limit = 5) {
  const ready = useAuthReady();
  return useQuery({
    queryKey: ["leads", "hot", limit] as const,
    queryFn: () => apiGet<{ items: HotLead[]; total: number }>(`/api/leads/hot?limit=${limit}`),
    enabled: ready,
    staleTime: 60_000,
  });
}

export function useMyLeadsTotal() {
  const ready = useAuthReady();
  const userId = getCurrentUserId();
  const params = new URLSearchParams({
    page: "1",
    pageSize: "1",
    excludeDuplicates: "true",
  });
  if (userId) params.set("assignedTo", userId);

  return useQuery({
    queryKey: ["leads", "my-total", userId],
    queryFn: async () => {
      const data = await apiGet<{ total: number }>(`/api/leads?${params.toString()}`);
      return data.total;
    },
    enabled: ready,
    staleTime: LEAD_STALE_MS,
  });
}
