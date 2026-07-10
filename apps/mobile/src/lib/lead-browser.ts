import type { LeadRow } from "@/hooks/use-leads";
import { isNaLeadStatus } from "@/lib/lead-status-options";

export type LeadBrowserItem = Pick<LeadRow, "id"> & { leadStatus?: string | null };

export type LeadBrowserParams = {
  leadId: string;
  leadIds?: string[];
  leadIndex?: number;
};

export function activeLeadIds(leads: LeadBrowserItem[]): string[] {
  return leads.filter((lead) => !isNaLeadStatus(lead.leadStatus ?? "")).map((lead) => lead.id);
}

export function buildLeadBrowserParams(
  leads: LeadBrowserItem[],
  leadId: string,
): { leadId: string; leadIds: string[]; leadIndex: number } {
  const leadIds = activeLeadIds(leads);
  const leadIndex = leadIds.indexOf(leadId);
  return {
    leadId,
    leadIds,
    leadIndex: leadIndex >= 0 ? leadIndex : 0,
  };
}

export function resolveLeadBrowser(params: LeadBrowserParams) {
  const leadIds = params.leadIds ?? [];
  const leadIndex =
    params.leadIndex ?? (params.leadIds ? params.leadIds.indexOf(params.leadId) : -1);
  return { leadIds, leadIndex };
}

type CachedLeadList = {
  items?: LeadRow[];
  pages?: { items?: LeadRow[] }[];
};

/** Pull lead ids from any cached leads list / infinite query (for swipe when opened via deep link). */
export function collectLeadIdsFromCache(
  queries: ReadonlyArray<readonly [unknown, unknown]>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const [, data] of queries) {
    if (!data || typeof data !== "object") continue;
    const record = data as CachedLeadList;

    const pushItems = (items: LeadRow[] | undefined) => {
      for (const item of items ?? []) {
        if (!item?.id || seen.has(item.id) || isNaLeadStatus(item.leadStatus)) continue;
        seen.add(item.id);
        ids.push(item.id);
      }
    };

    if (Array.isArray(record.pages)) {
      for (const page of record.pages) pushItems(page.items);
    } else {
      pushItems(record.items);
    }
  }

  return ids;
}

export function resolveLeadQueue(
  params: LeadBrowserParams,
  _cachedIds: string[],
): { leadIds: string[]; leadIndex: number } {
  const paramResolved = resolveLeadBrowser(params);

  if (paramResolved.leadIds.length > 1) {
    return {
      leadIds: paramResolved.leadIds,
      leadIndex:
        paramResolved.leadIndex >= 0
          ? paramResolved.leadIndex
          : paramResolved.leadIds.indexOf(params.leadId),
    };
  }

  if (paramResolved.leadIds.length === 1) {
    return { leadIds: paramResolved.leadIds, leadIndex: paramResolved.leadIndex };
  }

  return { leadIds: [params.leadId], leadIndex: 0 };
}

export function nextLeadInBrowser(leadIds: string[], currentIndex: number) {
  const nextIndex = currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= leadIds.length) return null;
  return { leadId: leadIds[nextIndex]!, leadIndex: nextIndex };
}

export function previousLeadInBrowser(leadIds: string[], currentIndex: number) {
  const prevIndex = currentIndex - 1;
  if (prevIndex < 0 || prevIndex >= leadIds.length) return null;
  return { leadId: leadIds[prevIndex]!, leadIndex: prevIndex };
}

/** After NA / dropped, advance to the next lead or return null when the queue is exhausted. */
export function nextLeadAfterExit(leadIds: string[], closedLeadId: string, currentIndex: number) {
  const start = currentIndex >= 0 ? currentIndex + 1 : 0;
  for (let i = start; i < leadIds.length; i++) {
    const leadId = leadIds[i]!;
    if (leadId === closedLeadId) continue;
    return { leadId, leadIndex: i };
  }
  return null;
}

export function leadIdsWithout(leadIds: string[], excludeId: string) {
  return leadIds.filter((id) => id !== excludeId);
}
