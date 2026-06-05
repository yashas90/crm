import { apiGet, apiPost } from "@/lib/apiClient";
import { getCurrentUserId } from "@/lib/auth";
import { todayRange } from "@/lib/dates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  direction: "incoming" | "outgoing";
  status: "completed" | "missed" | "rejected" | "failed";
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  disposition: string;
  notes?: string;
  source: "mobile-manual";
};

export function useCalls(params: Record<string, string>) {
  const search = new URLSearchParams(params);

  return useQuery({
    queryKey: ["calls", search.toString()],
    queryFn: () =>
      apiGet<{ items: CallRecord[]; page: number; pageSize: number; total: number }>(
        `/api/calls?${search.toString()}`,
      ),
    enabled: Boolean(params.lead_id || params.user_id || params.date_from),
  });
}

export function useTodayCalls() {
  const { dateFrom, dateTo } = todayRange();
  const params = new URLSearchParams({
    user_id: getCurrentUserId(),
    date_from: dateFrom,
    date_to: dateTo,
    page: "1",
    pageSize: "100",
  });

  return useQuery({
    queryKey: ["calls", "today", getCurrentUserId()],
    queryFn: () =>
      apiGet<{ items: CallRecord[]; page: number; pageSize: number; total: number }>(
        `/api/calls?${params.toString()}`,
      ),
  });
}

export function useTodayCallSummary() {
  const { dateFrom, dateTo } = todayRange();
  const params = new URLSearchParams({
    user_id: getCurrentUserId(),
    date_from: dateFrom,
    date_to: dateTo,
  });

  return useQuery({
    queryKey: ["calls", "summary", "today", getCurrentUserId()],
    queryFn: () => apiGet<CallSummary>(`/api/calls/summary?${params.toString()}`),
  });
}

export function useLogCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LogCallInput) => apiPost("/api/calls/log", payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["calls"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (variables.lead_id) {
        await queryClient.invalidateQueries({ queryKey: ["leads", variables.lead_id] });
      }
    },
  });
}
