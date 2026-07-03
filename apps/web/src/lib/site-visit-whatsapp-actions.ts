import type { SiteVisit } from "@/hooks/use-site-visits";
import { prepareSiteVisitWhatsApp, siteVisitToMessageContext } from "@/lib/site-visit-whatsapp";
import type { SiteVisitMessageKind } from "@propninja/types/site-visit-messages";
import { buildWhatsAppUrl } from "@propninja/types/message-templates";

export function openCustomerSiteVisitWhatsApp(
  visit: SiteVisit,
  kind: SiteVisitMessageKind = "scheduled",
) {
  const ctx = siteVisitToMessageContext(visit);
  const prepared = prepareSiteVisitWhatsApp("customer", kind, ctx, visit.lead?.phone);
  if (!prepared.prepared || !prepared.whatsappUrl) return false;
  window.open(prepared.whatsappUrl, "_blank", "noopener,noreferrer");
  return true;
}

export function customerSiteVisitWhatsAppUrl(
  visit: SiteVisit,
  kind: SiteVisitMessageKind = "scheduled",
) {
  const ctx = siteVisitToMessageContext(visit);
  const prepared = prepareSiteVisitWhatsApp("customer", kind, ctx, visit.lead?.phone);
  return prepared.whatsappUrl ?? buildWhatsAppUrl(visit.lead?.phone ?? "", prepared.body);
}
