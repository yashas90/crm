import type { SiteVisit } from "@/hooks/use-site-visits";
import { visitLeadName } from "@/hooks/use-site-visits";
import { getUser } from "@/lib/auth";
import { openWhatsAppWithMessage } from "@/lib/whatsappTemplates";
import {
  type SiteVisitMessageContext,
  type SiteVisitMessageKind,
  prepareSiteVisitWhatsApp,
  prepareSiteVisitWhatsAppPair,
} from "@propninja/types/site-visit-messages";

export function siteVisitToMessageContext(
  visit: SiteVisit,
  options?: { agentName?: string; agentPhone?: string | null },
): SiteVisitMessageContext {
  const agent = getUser();
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
    agentName: options?.agentName ?? visit.agent?.name ?? agent?.name ?? "Your consultant",
    agentPhone: options?.agentPhone ?? visit.agent?.phone ?? null,
    duration: visit.duration,
  };
}

export function buildVisitWhatsAppLinks(
  visit: SiteVisit,
  kind: SiteVisitMessageKind = "scheduled",
) {
  const ctx = siteVisitToMessageContext(visit);
  return prepareSiteVisitWhatsAppPair(kind, ctx, {
    customerPhone: visit.lead?.phone,
    agentPhone: visit.agent?.phone,
  });
}

export async function openCustomerSiteVisitWhatsApp(
  visit: SiteVisit,
  kind: SiteVisitMessageKind = "scheduled",
) {
  const ctx = siteVisitToMessageContext(visit);
  const prepared = prepareSiteVisitWhatsApp("customer", kind, ctx, visit.lead?.phone);
  if (!prepared.prepared || !prepared.phone) {
    return { ok: false as const, error: prepared.error ?? "NO_PHONE" };
  }
  const opened = await openWhatsAppWithMessage(prepared.phone, prepared.body);
  return opened ? { ok: true as const } : { ok: false as const, error: "OPEN_FAILED" };
}
