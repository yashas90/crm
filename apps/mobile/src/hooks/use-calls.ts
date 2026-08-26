import { apiGet, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { todayRange } from "@/lib/dates";
import { invalidateQueriesAfterCallLog } from "@/lib/invalidateQueriesAfterCallLog";
import { lightweightLiveQueryOptions } from "@/lib/liveQuery";

const live = lightweightLiveQueryOptions();
import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export { invalidateQueriesAfterCallLog } from "@/lib/invalidateQueriesAfterCallLog";

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
};

export type CallSummary = {
  total_calls: number;
  completed_calls: number;
  missed_calls: number;
  average_duration: number;
};

export type LogCallInput = {
  lead_id?: string;
  phone_number: string;
  direction?: "incoming" | "outgoing";
  status?: "completed" | "missed" | "rejected" | "failed";
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  outcome: "answered" | "no_answer" | "busy" | "left_voicemail";
  disposition?: string;
  notes?: string;
  /** Reserved for future analytics; API ignores this field today. */
  ring_seconds?: number;
  source: "mobile-manual" | "mobile-auto" | "mobile-dialpad" | "web-manual";
};

function useAuthReady() {
  const { status } = useAuth();
  return status === "authenticated" && Boolean(getCurrentUserId());
}

export function useCalls(
  params: Record<string, string>,
  options?: { suppressErrorToast?: boolean },
) {
  const ready = useAuthReady();
  const search = new URLSearchParams(params);

  return useQuery({
    queryKey: ["calls", search.toString()],
    queryFn: () =>
      apiGet<{ items: CallRecord[]; page: number; pageSize: number; total: number }>(
        `/api/calls?${search.toString()}`,
      ),
    enabled: ready && Boolean(params.lead_id || params.user_id || params.date_from),
    staleTime: 30_000,
    meta: { suppressErrorToast: options?.suppressErrorToast ?? false },
  });
}

export function useTodayCalls() {
  const ready = useAuthReady();
  const userId = getCurrentUserId();
  const { dateFrom, dateTo } = todayRange();
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    page: "1",
    pageSize: "100",
  });
  if (userId) params.set("user_id", userId);

  return useQuery({
    queryKey: ["calls", "today", userId],
    queryFn: () =>
      apiGet<{ items: CallRecord[]; page: number; pageSize: number; total: number }>(
        `/api/calls?${params.toString()}`,
      ),
    enabled: ready,
    staleTime: 30_000,
    ...live,
    meta: { suppressErrorToast: true },
  });
}

export function useTodayCallSummary() {
  const ready = useAuthReady();
  const userId = getCurrentUserId();
  const { dateFrom, dateTo } = todayRange();
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  if (userId) params.set("user_id", userId);

  return useQuery({
    queryKey: ["calls", "summary", "today", userId],
    queryFn: () => apiGet<CallSummary>(`/api/calls/summary?${params.toString()}`),
    enabled: ready,
    staleTime: 30_000,
    ...live,
    meta: { suppressErrorToast: true },
  });
}

/**
 * Cache refresh after a successful call log.
 * Must invalidate with default (active) refetch so mounted lists update;
 * callers must not await this from the mutation critical path.
 */
export function useLogCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LogCallInput) => apiPost("/api/calls/log", payload),
    onSuccess: (_data, variables) => {
      // Fire-and-forget — do not await. Awaiting blocked the post-call status sheet.
      invalidateQueriesAfterCallLog(queryClient, variables, getCurrentUserId());
    },
  });
}
