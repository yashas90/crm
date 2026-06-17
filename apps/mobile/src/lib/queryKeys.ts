/** Shared React Query keys — same key = automatic request deduplication. */

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  calls: {
    list: (params: string) => ["calls", params] as const,
    today: (userId: string | null | undefined) => ["calls", "today", userId ?? "me"] as const,
    summaryToday: (userId: string | null | undefined) =>
      ["calls", "summary", "today", userId ?? "me"] as const,
    summaryWeek: (userId: string | null | undefined) =>
      ["calls", "summary", "week", userId ?? "me"] as const,
    history: (dateFilter: string, outcome: string) =>
      ["calls", "history", dateFilter, outcome] as const,
    team: (dateFilter: string, outcome: string, agentId: string) =>
      ["calls", "team", dateFilter, outcome, agentId] as const,
  },
  leads: {
    list: (params: string) => ["leads", params] as const,
    infinite: (params: string) => ["leads", "infinite", params] as const,
    detail: (leadId: string) => ["leads", leadId] as const,
    assignments: (leadId: string) => ["leads", leadId, "assignments"] as const,
    queue: (userId: string | null | undefined, dateTo: string) =>
      ["leads", "queue", userId ?? "me", dateTo] as const,
    scopeCounts: ["leads", "scope-counts"] as const,
    cold: ["leads", "cold"] as const,
    hot: (limit: number) => ["leads", "hot", limit] as const,
    dupCheck: (phone: string) => ["leads", "dup-check", phone] as const,
  },
  documents: {
    list: (search: string) => ["documents", search] as const,
    lead: (leadId: string) => ["lead-documents", leadId] as const,
  },
  reports: {
    agentStats: (agentId: string) => ["reports", "agent-stats", agentId] as const,
    teamToday: (dateFrom: string, dateTo: string) =>
      ["reports", "team-today", dateFrom, dateTo] as const,
  },
};
