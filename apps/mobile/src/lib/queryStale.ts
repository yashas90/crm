/** Shared React Query stale times (ms). */
export const QUERY_STALE = {
  leads: 2 * 60_000,
  leadDetail: 30_000,
  agents: 5 * 60_000,
  properties: 10 * 60_000,
  calls: 5 * 60_000,
  tasks: 60_000,
  notifications: 60_000,
} as const;

export const LIST_PAGE_SIZE = 20;
