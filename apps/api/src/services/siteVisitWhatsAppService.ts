import { whatsappTemplates } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  type SiteVisitMessageContext,
  type SiteVisitMessageKind,
  buildAgentSiteVisitMessage,
  buildCustomerSiteVisitMessage,
} from "../lib/siteVisitMessages.js";
import {
  buildTemplateComponents,
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
  toWhatsAppRecipient,
} from "../lib/whatsapp.js";

export type SiteVisitWhatsAppRecipient = "customer" | "agent";

export type SiteVisitWhatsAppResult = {
  sent: boolean;
  error?: string;
  waMessageId?: string;
  templateName?: string;
  body: string;
};

function templateEnvKey(
  recipient: SiteVisitWhatsAppRecipient,
  event: SiteVisitMessageKind,
): string | null {
  if (recipient === "customer") {
    if (event === "reminder") return process.env.WHATSAPP_SITE_VISIT_REMINDER_TEMPLATE ?? null;
    if (event === "cancelled") return process.env.WHATSAPP_SITE_VISIT_CANCEL_TEMPLATE ?? null;
    return process.env.WHATSAPP_SITE_VISIT_CUSTOMER_TEMPLATE ?? null;
  }
  return process.env.WHATSAPP_SITE_VISIT_AGENT_TEMPLATE ?? null;
}

function templateVariables(
  recipient: SiteVisitWhatsAppRecipient,
  kind: SiteVisitMessageKind,
  ctx: SiteVisitMessageContext,
): Record<string, string> {
  const project = [ctx.projectName, ctx.tower, ctx.unitLabel].filter(Boolean).join(" · ") || "TBC";
  const location = ctx.mapsLink ?? ctx.meetingLocation ?? "As discussed";
  const body =
    recipient === "customer"
      ? buildCustomerSiteVisitMessage(kind, ctx)
      : buildAgentSiteVisitMessage(kind, ctx);

  return {
    customer_name: ctx.customerName,
    customer: ctx.customerName,
    name: ctx.customerName,
    phone: ctx.customerPhone ?? "",
    customer_phone: ctx.customerPhone ?? "",
    project,
    project_name: ctx.projectName ?? "",
    tower: ctx.tower ?? "",
    unit: ctx.unitLabel ?? "",
    date: ctx.visitDate,
    time: ctx.visitTime,
    location,
    maps_link: ctx.mapsLink ?? "",
    agent_name: ctx.agentName,
    agent: ctx.agentName,
    agent_phone: ctx.agentPhone ?? "",
    body,
    message: body,
  };
}

async function resolveTemplate(database: Database, templateName: string) {
  const [row] = await database
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.orgId, SINGLE_TENANT_ORG_ID),
        eq(whatsappTemplates.templateName, templateName),
        eq(whatsappTemplates.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function sendSiteVisitWhatsApp(input: {
  leadId: string;
  sentBy: string;
  phone: string | null | undefined;
  recipient: SiteVisitWhatsAppRecipient;
  event: SiteVisitMessageKind;
  context: SiteVisitMessageContext;
  database?: Database;
}): Promise<SiteVisitWhatsAppResult> {
  const database = input.database ?? db;
  const kind = input.event;
  const body =
    input.recipient === "customer"
      ? buildCustomerSiteVisitMessage(kind, input.context)
      : buildAgentSiteVisitMessage(kind, input.context);

  if (!input.phone?.trim()) {
    return { sent: false, error: "NO_PHONE", body };
  }

  const templateName = templateEnvKey(input.recipient, input.event);
  if (!isWhatsAppConfigured()) {
    logger.info("Site visit WhatsApp skipped — not configured", {
      leadId: input.leadId,
      recipient: input.recipient,
      event: input.event,
    });
    return { sent: false, error: "NOT_CONFIGURED", body, templateName: templateName ?? undefined };
  }

  if (!templateName) {
    logger.info("Site visit WhatsApp skipped — template env not set", {
      leadId: input.leadId,
      recipient: input.recipient,
      event: input.event,
    });
    return { sent: false, error: "TEMPLATE_NOT_CONFIGURED", body };
  }

  const template = await resolveTemplate(database, templateName);
  const variables = templateVariables(input.recipient, kind, input.context);
  const components = template ? buildTemplateComponents(template.variables ?? [], variables) : [];

  try {
    const result = await sendWhatsAppTemplate({
      to: input.phone,
      templateName,
      language: process.env.WHATSAPP_SITE_VISIT_TEMPLATE_LANG ?? template?.language ?? "en",
      components,
    });
    logger.info("Site visit WhatsApp sent", {
      leadId: input.leadId,
      recipient: input.recipient,
      event: input.event,
      waMessageId: result.waMessageId,
    });
    return {
      sent: true,
      waMessageId: result.waMessageId,
      templateName,
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Site visit WhatsApp send failed", {
      leadId: input.leadId,
      recipient: input.recipient,
      event: input.event,
      message,
    });
    return { sent: false, error: message, templateName, body };
  }
}

export function formatWhatsAppPhoneForLog(phone: string) {
  return toWhatsAppRecipient(phone);
}
