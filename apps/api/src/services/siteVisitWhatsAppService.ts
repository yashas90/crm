import { logger } from "../lib/logger.js";
import {
  type SiteVisitMessageContext,
  type SiteVisitMessageKind,
  type SiteVisitWhatsAppPrepared,
  type SiteVisitWhatsAppRecipient,
  prepareSiteVisitWhatsApp,
} from "../lib/siteVisitMessages.js";

export type SiteVisitWhatsAppResult = SiteVisitWhatsAppPrepared;

/** Prepare wa.me link + message body — does not call Meta WhatsApp Cloud API. */
export async function sendSiteVisitWhatsApp(input: {
  leadId: string;
  sentBy: string;
  phone: string | null | undefined;
  recipient: SiteVisitWhatsAppRecipient;
  event: SiteVisitMessageKind;
  context: SiteVisitMessageContext;
}): Promise<SiteVisitWhatsAppResult> {
  const result = prepareSiteVisitWhatsApp(input.recipient, input.event, input.context, input.phone);

  if (result.prepared) {
    logger.info("Site visit WhatsApp link prepared", {
      leadId: input.leadId,
      recipient: input.recipient,
      event: input.event,
    });
  } else {
    logger.info("Site visit WhatsApp skipped", {
      leadId: input.leadId,
      recipient: input.recipient,
      event: input.event,
      reason: result.error,
    });
  }

  return result;
}
