function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

import { normalizeLeadSourceValue } from "@/lib/lead-sources";

function sourceFilterValue(displayName: string) {
  return normalizeLeadSourceValue(displayName) || displayName.trim();
}

export const drillDownRoutes = {
  totalLeads: () => "/leads",
  activeLeads: () => "/leads?active=true",
  unassignedLeads: () => "/leads?unassigned=true",
  todayCalls: () => {
    const today = todayDateKey();
    return `/reports/calls?date_preset=custom&from=${today}&to=${today}`;
  },
  leadsBySource: (displayName: string) =>
    `/leads?source=${encodeURIComponent(sourceFilterValue(displayName))}`,
  adLeads: () => "/leads?ad_leads=true",
  leadsByDate: (date: string) => `/leads?from=${date}&to=${date}`,
  callsByDate: (date: string) => `/reports/calls?date_preset=custom&from=${date}&to=${date}`,
};
