import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export type SlaSummary = {
  inactive_1d: number;
  inactive_3d: number;
  inactive_7d: number;
  inactive_14d: number;
  flagged: number;
  defaultInactiveDays: number;
  thresholds: number[];
};

export type SlaBreachedLead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  leadStatus: string;
  daysSinceActivity: number;
  inactiveSince: string;
  assignedUser: { id: string; name: string } | null;
};

export type SlaBreachedList = {
  items: SlaBreachedLead[];
  total: number;
  page: number;
  pageSize: number;
  inactiveDays: number;
};

export function useSlaSummary() {
  return useQuery({
    queryKey: ["sla", "summary"],
    queryFn: () => apiGet<SlaSummary>("/api/sla/summary"),
    staleTime: 60_000,
  });
}

export function useSlaBreached(inactiveDays = 3, page = 1) {
  const search = new URLSearchParams({
    inactiveDays: String(inactiveDays),
    page: String(page),
    pageSize: "50",
  });

  return useQuery({
    queryKey: ["sla", "breached", inactiveDays, page],
    queryFn: () => apiGet<SlaBreachedList>(`/api/sla/breached?${search.toString()}`),
    staleTime: 30_000,
  });
}
