import type { LeadRow } from "@/hooks/use-leads";
import { isNaLeadStatus } from "@/lib/lead-status-options";

export type LeadBrowserParams = {
  leadId: string;
  leadIds?: string[];
  leadIndex?: number;
};

export function activeLeadIds(leads: LeadRow[]): string[] {
  return leads.filter((lead) => !isNaLeadStatus(lead.leadStatus)).map((lead) => lead.id);
}

export function buildLeadBrowserParams(
  leads: LeadRow[],
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
    params.leadIndex ??
    (params.leadIds ? params.leadIds.indexOf(params.leadId) : -1);
  return { leadIds, leadIndex };
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
