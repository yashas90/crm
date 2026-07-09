import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import {
  type SiteVisitMessageContext,
  type SiteVisitMessageKind,
  type SiteVisitWhatsAppPrepared,
  type SiteVisitWhatsAppRecipient,
  buildCustomerSiteVisitMessage,
  prepareSiteVisitWhatsApp,
} from "../lib/siteVisitMessages.js";
import {
  WHATSAPP_GRAPH_API_VERSION,
  isWhatsAppConfigured,
  toWhatsAppRecipient,
} from "../lib/whatsapp.js";

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

/**
 * Auto-sends a WhatsApp text message to the client via Meta Cloud API.
 * Falls back silently when WhatsApp is unconfigured or client has no phone.
 */
export async function sendClientSiteVisitWhatsAppDirect(input: {
  leadId: string;
  sentBy: string;
  phone: string | null | undefined;
  event: SiteVisitMessageKind;
  context: SiteVisitMessageContext;
}): Promise<{ sent: boolean; error?: string }> {
  if (!isWhatsAppConfigured()) return { sent: false, error: "WA_NOT_CONFIGURED" };
  if (!input.phone?.trim()) return { sent: false, error: "NO_PHONE" };

  const token = env.WHATSAPP_API_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return { sent: false, error: "WA_NOT_CONFIGURED" };

  const body = buildCustomerSiteVisitMessage(input.event, input.context);
  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toWhatsAppRecipient(input.phone),
        type: "text",
        text: { body },
      }),
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: { message?: string } };
      logger.error("Client site visit WhatsApp send failed", {
        leadId: input.leadId,
        event: input.event,
        status: response.status,
        waError: json.error?.message,
      });
      return { sent: false, error: json.error?.message ?? "SEND_FAILED" };
    }

    logger.info("Client site visit WhatsApp sent", { leadId: input.leadId, event: input.event });
    return { sent: true };
  } catch (error) {
    logger.error("Client site visit WhatsApp exception", {
      leadId: input.leadId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, error: "EXCEPTION" };
  }
}
