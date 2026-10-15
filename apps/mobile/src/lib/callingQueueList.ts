/**
 * The calling queue must stay put while an agent is dialing.
 * Focus, reconnect, and a blanket cache invalidation (NetInfo flickers when
 * the phone app opens) used to replace this list and Android snapped it to the top.
 */

export const CALLING_QUEUE_QUERY = {
  retry: false as const,
  refetchInterval: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
  meta: { suppressErrorToast: true },
};

/**
 * `static` (not Infinity) is what this React Query version skips inside
 * invalidateQueries. A dialer return invalidates active queries; Infinity still refetches.
 */
export const CALLING_LIST_QUERY = {
  ...CALLING_QUEUE_QUERY,
  refetchOnMount: false as const,
  staleTime: "static" as const,
};

type RowIdentity = { recordId: string };

/**
 * Apply a newer payload without reordering rows the agent is already looking at.
 * New ids are appended. Missing ids drop out in place.
 */
export function mergeCallingRows<T extends RowIdentity>(
  previous: readonly T[],
  incoming: readonly T[],
): readonly T[] {
  if (incoming === previous) return previous;
  if (previous.length === 0) return incoming;

  const incomingById = new Map(incoming.map((row) => [row.recordId, row]));
  let changed = false;
  const merged: T[] = [];
  for (const row of previous) {
    const next = incomingById.get(row.recordId);
    if (!next) {
      changed = true;
      continue;
    }
    incomingById.delete(row.recordId);
    if (next !== row) changed = true;
    merged.push(next);
  }
  for (const row of incoming) {
    if (!incomingById.has(row.recordId)) continue;
    merged.push(row);
    changed = true;
  }
  if (!changed) return previous;
  return merged;
}

/** While the dialer or outcome sheet is open, keep the exact array the list already has. */
export function resolveDisplayedCallingRows<T extends RowIdentity>(
  previous: readonly T[],
  incoming: readonly T[],
  callInProgress: boolean,
): readonly T[] {
  if (callInProgress && previous.length > 0) return previous;
  return mergeCallingRows(previous, incoming);
}

/**
 * Pixel offset to put back after a call. Never scroll during the call, and never to the top.
 */
export function callingListRestoreOffset(
  callInProgress: boolean,
  offset: number | null,
): number | null {
  if (callInProgress) return null;
  if (offset == null || !(offset > 0)) return null;
  return offset;
}

/** Queue payload. Stats may refresh the tab badge; they must not replace this list. */
export function isCallingListQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  return head === "calling-data" || head === "calling-daily-status";
}

export function applyOutcomeToCallingRows<
  T extends { recordId: string; status: string; callAttempts: number },
>(
  rows: readonly T[] | undefined,
  recordId: string,
  result: { removed?: boolean; callingStatus?: string; callAttempts?: number },
): readonly T[] | undefined {
  if (!rows) return rows;
  if (result.removed) return rows.filter((row) => row.recordId !== recordId);
  if (result.callingStatus == null && result.callAttempts == null) return rows;
  let changed = false;
  const next = rows.map((row) => {
    if (row.recordId !== recordId) return row;
    const status = result.callingStatus ?? row.status;
    const callAttempts = result.callAttempts ?? row.callAttempts;
    if (status === row.status && callAttempts === row.callAttempts) return row;
    changed = true;
    return { ...row, status, callAttempts };
  });
  return changed ? next : rows;
}
