import type { SiteVisit } from "@/hooks/use-site-visits";
import { visitLeadName } from "@/hooks/use-site-visits";
import type { SiteVisitMessageContext } from "@propninja/types/site-visit-messages";

export function siteVisitToMessageContext(visit: SiteVisit): SiteVisitMessageContext {
  return {
    customerName: visitLeadName(visit),
    customerPhone: visit.lead?.phone ?? null,
    projectName: visit.project?.name ?? null,
    unitLabel: visit.unit?.unitNumber ?? null,
    tower: visit.tower ?? null,
    visitDate: visit.visitDate,
    visitTime: visit.visitTime,
    mapsLink: visit.mapsLink ?? null,
    meetingLocation: visit.meetingLocation ?? visit.propertyAddress ?? null,
    agentName: visit.agent?.name ?? "Your consultant",
    agentPhone: visit.agent?.phone ?? null,
    duration: visit.duration,
  };
}

export { prepareSiteVisitWhatsApp } from "@propninja/types/site-visit-messages";
