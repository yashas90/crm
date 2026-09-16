import {
  projects,
  users,
  whatsappBlastMessages,
  whatsappBlastTemplates,
  whatsappCampaigns,
  whatsappContacts,
  whatsappLeads,
} from "@propninja/db";
import { getIstDateKey } from "@propninja/types/ist";
import {
  DEFAULT_BLAST_MESSAGE_BODY,
  DEFAULT_WHATSAPP_BUTTONS,
  DEFAULT_WHATSAPP_QUESTION_FLOW,
  type ParsedWhatsAppContact,
  WHATSAPP_BLAST_LEAD_SOURCE,
  WHATSAPP_SENDING_SPEED_MS,
  type WhatsAppCampaignStatus,
  type WhatsAppColumnMapping,
  type WhatsAppMediaType,
  type WhatsAppProviderInfo,
  type WhatsAppQuestionFlow,
  type WhatsAppSendingSpeed,
  type WhatsAppTemplateButton,
  detectCallBackIntent,
  detectInterestedIntent,
  detectNotInterestedIntent,
  findQuestion,
  formatIndianWhatsAppPhone,
  formatWhatsAppCampaignCode,
  formatWhatsAppLeadCode,
  mapWhatsAppContacts,
  matchButtonAction,
  nextQuestionAfterAnswer,
  parseDelimitedTable,
  renderWhatsAppTemplate,
} from "@propninja/types/whatsapp-blaster";
import { and, asc, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { badRequest, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { parseSpreadsheetBuffer } from "../lib/parseSpreadsheet.js";
import {
  type WhatsAppInboundMessage,
  type WhatsAppStatusUpdate,
  isWhatsAppConfigured,
  sendWhatsAppInteractiveButtons,
  sendWhatsAppMedia,
  sendWhatsAppText,
} from "../lib/whatsapp.js";
import { leadService } from "./leadService.js";
import { NOTIFICATION_TYPES, createNotificationService } from "./notificationService.js";

const notifications = createNotificationService(db);

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function asButtons(raw: unknown): WhatsAppTemplateButton[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_WHATSAPP_BUTTONS;
  return raw as WhatsAppTemplateButton[];
}

function asFlow(raw: unknown): WhatsAppQuestionFlow {
  if (raw && typeof raw === "object" && Array.isArray((raw as WhatsAppQuestionFlow).questions)) {
    return raw as WhatsAppQuestionFlow;
  }
  return DEFAULT_WHATSAPP_QUESTION_FLOW;
}

function providerInfo(): WhatsAppProviderInfo {
  if (isWhatsAppConfigured()) {
    return { provider: "meta", configured: true, label: "WhatsApp Business API (Meta)" };
  }
  return {
    provider: env.ALLOW_DEMO_AUTH ? "meta" : "none",
    configured: false,
    label: env.ALLOW_DEMO_AUTH
      ? "Demo mode (Meta Cloud API not configured — messages are simulated)"
      : "WhatsApp Business API (Meta) — not configured",
  };
}

function canSimulate() {
  return !isWhatsAppConfigured() && env.ALLOW_DEMO_AUTH;
}

async function allocateCampaignCode() {
  const [row] = await db
    .select({
      maxSeq: sql<number | null>`max(
        CASE
          WHEN ${whatsappCampaigns.campaignCode} ~ '^WC-[0-9]+$'
          THEN cast(substring(${whatsappCampaigns.campaignCode} from 4) as integer)
          ELSE NULL
        END
      )`,
    })
    .from(whatsappCampaigns)
    .where(eq(whatsappCampaigns.orgId, SINGLE_TENANT_ORG_ID));
  return formatWhatsAppCampaignCode(Number(row?.maxSeq ?? 0) + 1);
}

async function allocateWhatsAppLeadCode() {
  const [row] = await db
    .select({
      maxSeq: sql<number | null>`max(
        CASE
          WHEN ${whatsappLeads.leadCode} ~ '^WA-[0-9]+$'
          THEN cast(substring(${whatsappLeads.leadCode} from 4) as integer)
          ELSE NULL
        END
      )`,
    })
    .from(whatsappLeads)
    .where(eq(whatsappLeads.orgId, SINGLE_TENANT_ORG_ID));
  return formatWhatsAppLeadCode(Number(row?.maxSeq ?? 0) + 1);
}

function serializeCampaign(row: typeof whatsappCampaigns.$inferSelect) {
  return {
    id: row.id,
    campaignId: row.campaignCode,
    campaignCode: row.campaignCode,
    name: row.name,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    templateId: row.templateId,
    status: row.status as WhatsAppCampaignStatus,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    assignedAgentId: row.assignedAgentId,
    sendingSpeed: row.sendingSpeed as WhatsAppSendingSpeed,
    dailyLimit: row.dailyLimit,
    sentToday: row.sentToday,
    totalContacts: row.totalContacts,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    deliveredCount: row.deliveredCount,
    readCount: row.readCount,
    repliedCount: row.repliedCount,
    interestedCount: row.interestedCount,
    notInterestedCount: row.notInterestedCount,
    leadsGenerated: row.leadsGenerated,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeTemplate(row: typeof whatsappBlastTemplates.$inferSelect) {
  return {
    id: row.id,
    templateId: row.id,
    name: row.name,
    body: row.body,
    mediaUrl: row.mediaUrl,
    mediaType: (row.mediaType as WhatsAppMediaType | null) ?? null,
    buttons: asButtons(row.buttons),
    questionFlow: asFlow(row.questionFlow),
    thankYouMessage: row.thankYouMessage ?? asFlow(row.questionFlow).thankYouMessage,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeContact(row: typeof whatsappContacts.$inferSelect) {
  return {
    id: row.id,
    contactId: row.id,
    campaignId: row.campaignId,
    name: row.name,
    phone: row.phone,
    city: row.city,
    budget: row.budget,
    status: row.status,
    isValid: row.isValid,
    invalidReason: row.invalidReason,
    interestClickedAt: iso(row.interestClickedAt),
    questionAnswers: row.questionAnswers ?? {},
    currentQuestionId: row.currentQuestionId,
    leadId: row.leadId,
    unreadCount: row.unreadCount,
    lastInboundAt: iso(row.lastInboundAt),
    lastOutboundAt: iso(row.lastOutboundAt),
    createdAt: iso(row.createdAt),
  };
}

function serializeLead(row: typeof whatsappLeads.$inferSelect) {
  return {
    id: row.id,
    leadId: row.leadCode,
    leadCode: row.leadCode,
    campaignId: row.campaignId,
    contactId: row.contactId,
    contactPhone: row.contactPhone,
    name: row.name,
    budgetAnswer: row.budgetAnswer,
    locationAnswer: row.locationAnswer,
    timelineAnswer: row.timelineAnswer,
    allAnswers: row.allAnswers ?? {},
    sourceCampaign: row.sourceCampaign,
    propertyName: row.propertyName,
    assignedAgentId: row.assignedAgentId,
    status: row.status,
    convertedToLeadId: row.convertedToLeadId,
    interestAt: iso(row.interestAt),
    createdAt: iso(row.createdAt),
  };
}

function serializeMessage(row: typeof whatsappBlastMessages.$inferSelect) {
  return {
    id: row.id,
    messageId: row.id,
    campaignId: row.campaignId,
    contactId: row.contactId,
    waMessageId: row.waMessageId,
    direction: row.direction,
    type: row.type,
    content: row.content,
    status: row.status,
    timestamp: iso(row.createdAt),
    failedReason: row.failedReason,
    leadId: row.leadId,
  };
}

async function getCampaignOrThrow(campaignId: string) {
  const [row] = await db
    .select()
    .from(whatsappCampaigns)
    .where(
      and(eq(whatsappCampaigns.orgId, SINGLE_TENANT_ORG_ID), eq(whatsappCampaigns.id, campaignId)),
    )
    .limit(1);
  if (!row) throw notFound("Campaign not found");
  return row;
}

async function getTemplateForCampaign(campaign: typeof whatsappCampaigns.$inferSelect) {
  if (!campaign.templateId) {
    return {
      body: DEFAULT_BLAST_MESSAGE_BODY,
      mediaUrl: null as string | null,
      mediaType: null as WhatsAppMediaType | null,
      buttons: DEFAULT_WHATSAPP_BUTTONS,
      questionFlow: DEFAULT_WHATSAPP_QUESTION_FLOW,
      thankYouMessage: DEFAULT_WHATSAPP_QUESTION_FLOW.thankYouMessage,
    };
  }
  const [template] = await db
    .select()
    .from(whatsappBlastTemplates)
    .where(eq(whatsappBlastTemplates.id, campaign.templateId))
    .limit(1);
  if (!template) {
    return {
      body: DEFAULT_BLAST_MESSAGE_BODY,
      mediaUrl: null as string | null,
      mediaType: null as WhatsAppMediaType | null,
      buttons: DEFAULT_WHATSAPP_BUTTONS,
      questionFlow: DEFAULT_WHATSAPP_QUESTION_FLOW,
      thankYouMessage: DEFAULT_WHATSAPP_QUESTION_FLOW.thankYouMessage,
    };
  }
  const flow = asFlow(template.questionFlow);
  return {
    body: template.body,
    mediaUrl: template.mediaUrl,
    mediaType: (template.mediaType as WhatsAppMediaType | null) ?? null,
    buttons: asButtons(template.buttons),
    questionFlow: flow,
    thankYouMessage: template.thankYouMessage ?? flow.thankYouMessage,
  };
}

async function recordOutbound(input: {
  campaignId: string | null;
  contactId: string | null;
  type: "template" | "text" | "button_reply" | "media";
  content: string;
  status: "queued" | "sent" | "failed";
  waMessageId?: string | null;
  failedReason?: string | null;
  leadId?: string | null;
}) {
  const [row] = await db
    .insert(whatsappBlastMessages)
    .values({
      orgId: SINGLE_TENANT_ORG_ID,
      campaignId: input.campaignId,
      contactId: input.contactId,
      type: input.type,
      direction: "outbound",
      content: input.content,
      status: input.status,
      waMessageId: input.waMessageId ?? null,
      failedReason: input.failedReason ?? null,
      leadId: input.leadId ?? null,
    })
    .returning();
  return row!;
}

async function deliverToContact(input: {
  phone: string;
  body: string;
  buttons?: WhatsAppTemplateButton[];
  mediaUrl?: string | null;
  mediaType?: WhatsAppMediaType | null;
}) {
  if (canSimulate()) {
    return { waMessageId: `wamid.demo.${crypto.randomUUID()}`, simulated: true };
  }
  if (!isWhatsAppConfigured()) {
    throw new Error("WhatsApp API is not configured");
  }

  if (input.mediaUrl && input.mediaType) {
    const mediaKind =
      input.mediaType === "pdf" ? "document" : input.mediaType === "video" ? "video" : "image";
    await sendWhatsAppMedia({
      to: input.phone,
      mediaType: mediaKind,
      link: input.mediaUrl,
      caption: input.mediaType === "image" ? undefined : input.body.slice(0, 1024),
      filename: input.mediaType === "pdf" ? "brochure.pdf" : undefined,
    });
  }

  if (input.buttons && input.buttons.length > 0) {
    return {
      waMessageId: (
        await sendWhatsAppInteractiveButtons({
          to: input.phone,
          body: input.body,
          buttons: input.buttons.map((b) => ({ id: b.id, title: b.label })),
        })
      ).waMessageId,
      simulated: false,
    };
  }

  return {
    waMessageId: (await sendWhatsAppText(input.phone, input.body)).waMessageId,
    simulated: false,
  };
}

async function sendTextToContact(phone: string, text: string) {
  if (canSimulate()) {
    return { waMessageId: `wamid.demo.${crypto.randomUUID()}` };
  }
  if (!isWhatsAppConfigured()) {
    throw new Error("WhatsApp API is not configured");
  }
  return sendWhatsAppText(phone, text);
}

async function notifyAgent(
  userId: string | null | undefined,
  type: string,
  payload: Record<string, unknown>,
) {
  if (!userId) return;
  await notifications.createNotification(userId, type, payload, { push: true });
}

export const whatsappBlasterService = {
  providerInfo,

  parseContactsFromText(text: string, mapping?: Partial<WhatsAppColumnMapping>) {
    const { headers, rows } = parseDelimitedTable(text);
    return this.mapRows(headers, rows, mapping);
  },

  parseContactsFromFile(
    buffer: Buffer,
    filename: string,
    mapping?: Partial<WhatsAppColumnMapping>,
  ) {
    const { headers, rows } = parseSpreadsheetBuffer(buffer, filename);
    return this.mapRows(headers, rows, mapping);
  },

  mapRows(headers: string[], rows: string[][], mapping?: Partial<WhatsAppColumnMapping>) {
    const phone =
      mapping?.phone ??
      headers.find((h) => /phone|mobile|whatsapp|contact/i.test(h)) ??
      headers[1] ??
      headers[0] ??
      "";
    const resolved: WhatsAppColumnMapping = {
      phone,
      name: mapping?.name,
      city: mapping?.city,
      budget: mapping?.budget,
    };
    const parsed = mapWhatsAppContacts(headers, rows, resolved);
    return { ...parsed, mapping: resolved };
  },

  async listTemplates() {
    const rows = await db
      .select()
      .from(whatsappBlastTemplates)
      .where(eq(whatsappBlastTemplates.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(whatsappBlastTemplates.updatedAt));
    return rows.map(serializeTemplate);
  },

  async saveTemplate(input: {
    id?: string;
    name: string;
    body: string;
    mediaUrl?: string | null;
    mediaType?: WhatsAppMediaType | null;
    buttons?: WhatsAppTemplateButton[];
    questionFlow?: WhatsAppQuestionFlow;
    thankYouMessage?: string | null;
    createdBy: string;
  }) {
    const values = {
      orgId: SINGLE_TENANT_ORG_ID,
      name: input.name.trim(),
      body: input.body,
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      buttons: input.buttons ?? DEFAULT_WHATSAPP_BUTTONS,
      questionFlow: input.questionFlow ?? DEFAULT_WHATSAPP_QUESTION_FLOW,
      thankYouMessage:
        input.thankYouMessage ??
        (input.questionFlow ?? DEFAULT_WHATSAPP_QUESTION_FLOW).thankYouMessage,
      createdBy: input.createdBy,
      updatedAt: new Date(),
    };

    if (input.id) {
      const [updated] = await db
        .update(whatsappBlastTemplates)
        .set(values)
        .where(
          and(
            eq(whatsappBlastTemplates.orgId, SINGLE_TENANT_ORG_ID),
            eq(whatsappBlastTemplates.id, input.id),
          ),
        )
        .returning();
      if (!updated) throw notFound("Template not found");
      return serializeTemplate(updated);
    }

    const [created] = await db.insert(whatsappBlastTemplates).values(values).returning();
    return serializeTemplate(created!);
  },

  async deleteTemplate(id: string) {
    const deleted = await db
      .delete(whatsappBlastTemplates)
      .where(
        and(
          eq(whatsappBlastTemplates.orgId, SINGLE_TENANT_ORG_ID),
          eq(whatsappBlastTemplates.id, id),
        ),
      )
      .returning({ id: whatsappBlastTemplates.id });
    if (deleted.length === 0) throw notFound("Template not found");
  },

  async listCampaigns() {
    const rows = await db
      .select()
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(whatsappCampaigns.createdAt));
    return rows.map(serializeCampaign);
  },

  async getCampaign(id: string) {
    const campaign = await getCampaignOrThrow(id);
    const template = campaign.templateId
      ? (
          await db
            .select()
            .from(whatsappBlastTemplates)
            .where(eq(whatsappBlastTemplates.id, campaign.templateId))
            .limit(1)
        )[0]
      : null;
    const [agent] = campaign.assignedAgentId
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, campaign.assignedAgentId))
          .limit(1)
      : [null];
    return {
      ...serializeCampaign(campaign),
      template: template ? serializeTemplate(template) : null,
      assignedAgent: agent ?? null,
      provider: providerInfo(),
    };
  },

  async createCampaign(input: {
    name: string;
    propertyId?: string | null;
    templateId?: string | null;
    assignedAgentId?: string | null;
    sendingSpeed?: WhatsAppSendingSpeed;
    dailyLimit?: number;
    scheduledAt?: string | null;
    createdBy: string;
  }) {
    let propertyName: string | null = null;
    if (input.propertyId) {
      const [project] = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.id, input.propertyId))
        .limit(1);
      propertyName = project?.name ?? null;
    }

    const status: WhatsAppCampaignStatus = input.scheduledAt ? "scheduled" : "draft";
    const campaignCode = await allocateCampaignCode();

    const [created] = await db
      .insert(whatsappCampaigns)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        campaignCode,
        name: input.name.trim(),
        propertyId: input.propertyId ?? null,
        propertyName,
        templateId: input.templateId ?? null,
        assignedAgentId: input.assignedAgentId ?? null,
        sendingSpeed: input.sendingSpeed ?? "safe",
        dailyLimit: input.dailyLimit ?? 500,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status,
        createdBy: input.createdBy,
      })
      .returning();
    return serializeCampaign(created!);
  },

  async updateCampaign(
    id: string,
    patch: Partial<{
      name: string;
      propertyId: string | null;
      templateId: string | null;
      assignedAgentId: string | null;
      sendingSpeed: WhatsAppSendingSpeed;
      dailyLimit: number;
      scheduledAt: string | null;
    }>,
  ) {
    const current = await getCampaignOrThrow(id);
    if (current.status === "running") {
      throw badRequest("Pause the campaign before editing settings");
    }
    let propertyName = current.propertyName;
    if (patch.propertyId !== undefined) {
      if (patch.propertyId) {
        const [project] = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, patch.propertyId))
          .limit(1);
        propertyName = project?.name ?? null;
      } else {
        propertyName = null;
      }
    }
    const nextStatus =
      patch.scheduledAt !== undefined
        ? patch.scheduledAt
          ? "scheduled"
          : current.status === "scheduled"
            ? "draft"
            : current.status
        : current.status;
    const [updated] = await db
      .update(whatsappCampaigns)
      .set({
        name: patch.name ?? current.name,
        propertyId: patch.propertyId === undefined ? current.propertyId : patch.propertyId,
        propertyName,
        templateId: patch.templateId === undefined ? current.templateId : patch.templateId,
        assignedAgentId:
          patch.assignedAgentId === undefined ? current.assignedAgentId : patch.assignedAgentId,
        sendingSpeed: patch.sendingSpeed ?? current.sendingSpeed,
        dailyLimit: patch.dailyLimit ?? current.dailyLimit,
        scheduledAt:
          patch.scheduledAt === undefined
            ? current.scheduledAt
            : patch.scheduledAt
              ? new Date(patch.scheduledAt)
              : null,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    return serializeCampaign(updated!);
  },

  async replaceContacts(campaignId: string, contacts: ParsedWhatsAppContact[]) {
    const campaign = await getCampaignOrThrow(campaignId);
    if (campaign.status === "running") {
      throw badRequest("Pause the campaign before replacing contacts");
    }
    await db.delete(whatsappContacts).where(eq(whatsappContacts.campaignId, campaignId));

    const valid = contacts.filter((c) => c.valid && c.formattedPhone);
    const chunks: (typeof whatsappContacts.$inferInsert)[] = contacts.map((c) => ({
      orgId: SINGLE_TENANT_ORG_ID,
      campaignId,
      name: c.name,
      phone: c.formattedPhone ?? c.phone,
      city: c.city || null,
      budget: c.budget || null,
      status: c.valid ? "pending" : "invalid",
      isValid: c.valid,
      invalidReason: c.invalidReason,
    }));

    for (let i = 0; i < chunks.length; i += 500) {
      const slice = chunks.slice(i, i + 500);
      if (slice.length > 0) await db.insert(whatsappContacts).values(slice);
    }

    await db
      .update(whatsappCampaigns)
      .set({ totalContacts: valid.length, updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, campaignId));

    return {
      total: contacts.length,
      loaded: valid.length,
      invalid: contacts.filter((c) => !c.valid && !c.duplicate).length,
      duplicates: contacts.filter((c) => c.duplicate).length,
    };
  },

  async listContacts(campaignId: string) {
    await getCampaignOrThrow(campaignId);
    const rows = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.campaignId, campaignId))
      .orderBy(asc(whatsappContacts.createdAt));
    return rows.map(serializeContact);
  },

  async startCampaign(id: string) {
    const campaign = await getCampaignOrThrow(id);
    if (campaign.status === "completed") {
      throw badRequest("Campaign already completed");
    }
    const now = new Date();
    const [updated] = await db
      .update(whatsappCampaigns)
      .set({
        status: "running",
        startedAt: campaign.startedAt ?? now,
        updatedAt: now,
      })
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    await db
      .update(whatsappContacts)
      .set({ status: "queued" })
      .where(
        and(
          eq(whatsappContacts.campaignId, id),
          eq(whatsappContacts.isValid, true),
          inArray(whatsappContacts.status, ["pending"]),
        ),
      );
    return serializeCampaign(updated!);
  },

  async pauseCampaign(id: string) {
    const campaign = await getCampaignOrThrow(id);
    if (campaign.status !== "running") throw badRequest("Campaign is not running");
    const [updated] = await db
      .update(whatsappCampaigns)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    return serializeCampaign(updated!);
  },

  async resumeCampaign(id: string) {
    const campaign = await getCampaignOrThrow(id);
    if (campaign.status !== "paused") throw badRequest("Campaign is not paused");
    const [updated] = await db
      .update(whatsappCampaigns)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    return serializeCampaign(updated!);
  },

  async stopCampaign(id: string) {
    const campaign = await getCampaignOrThrow(id);
    if (campaign.status === "completed") return serializeCampaign(campaign);
    const [updated] = await db
      .update(whatsappCampaigns)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    return serializeCampaign(updated!);
  },

  async processSendQueue() {
    const now = new Date();
    const dueScheduled = await db
      .select()
      .from(whatsappCampaigns)
      .where(
        and(
          eq(whatsappCampaigns.orgId, SINGLE_TENANT_ORG_ID),
          eq(whatsappCampaigns.status, "scheduled"),
          lte(whatsappCampaigns.scheduledAt, now),
        ),
      );
    for (const campaign of dueScheduled) {
      await this.startCampaign(campaign.id);
    }

    const running = await db
      .select()
      .from(whatsappCampaigns)
      .where(
        and(
          eq(whatsappCampaigns.orgId, SINGLE_TENANT_ORG_ID),
          eq(whatsappCampaigns.status, "running"),
        ),
      );

    let sent = 0;
    for (const campaign of running) {
      sent += await this.processOneCampaign(campaign);
    }
    return { sent };
  },

  async processOneCampaign(campaign: typeof whatsappCampaigns.$inferSelect) {
    const today = getIstDateKey();
    let sentToday = campaign.sentToday;
    if (campaign.sentTodayDate !== today) {
      sentToday = 0;
    }
    if (sentToday >= campaign.dailyLimit) return 0;

    const delay = WHATSAPP_SENDING_SPEED_MS[campaign.sendingSpeed as WhatsAppSendingSpeed] ?? 3000;
    if (campaign.lastSentAt && Date.now() - campaign.lastSentAt.getTime() < delay) {
      return 0;
    }

    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(
        and(
          eq(whatsappContacts.campaignId, campaign.id),
          eq(whatsappContacts.isValid, true),
          inArray(whatsappContacts.status, ["pending", "queued"]),
        ),
      )
      .orderBy(asc(whatsappContacts.createdAt))
      .limit(1);

    if (!contact) {
      await db
        .update(whatsappCampaigns)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsappCampaigns.id, campaign.id));
      return 0;
    }

    const template = await getTemplateForCampaign(campaign);
    const body = renderWhatsAppTemplate(template.body, {
      name: contact.name,
      city: contact.city,
      budget: contact.budget,
      property_name: campaign.propertyName,
    });

    try {
      const result = await deliverToContact({
        phone: contact.phone,
        body,
        buttons: template.buttons,
        mediaUrl: template.mediaUrl,
        mediaType: template.mediaType,
      });
      const message = await recordOutbound({
        campaignId: campaign.id,
        contactId: contact.id,
        type: template.mediaUrl ? "media" : "template",
        content: body,
        status: "sent",
        waMessageId: result.waMessageId,
      });
      await db
        .update(whatsappContacts)
        .set({
          status: "sent",
          lastOutboundAt: new Date(),
          lastWaMessageId: result.waMessageId,
        })
        .where(eq(whatsappContacts.id, contact.id));
      await db
        .update(whatsappCampaigns)
        .set({
          sentCount: sql`${whatsappCampaigns.sentCount} + 1`,
          sentToday: sentToday + 1,
          sentTodayDate: today,
          lastSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappCampaigns.id, campaign.id));
      void message;
      return 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Send failed";
      logger.warn("WhatsApp blast send failed", { campaignId: campaign.id, reason });
      await recordOutbound({
        campaignId: campaign.id,
        contactId: contact.id,
        type: "template",
        content: body,
        status: "failed",
        failedReason: reason,
      });
      await db
        .update(whatsappContacts)
        .set({ status: "queued", invalidReason: reason })
        .where(eq(whatsappContacts.id, contact.id));
      if (/not configured|rate/i.test(reason)) {
        await db
          .update(whatsappCampaigns)
          .set({ lastSentAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappCampaigns.id, campaign.id));
        return 0;
      }
      await db
        .update(whatsappCampaigns)
        .set({
          failedCount: sql`${whatsappCampaigns.failedCount} + 1`,
          lastSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappCampaigns.id, campaign.id));
      await db
        .update(whatsappContacts)
        .set({ status: "pending" })
        .where(eq(whatsappContacts.id, contact.id));
      return 0;
    }
  },

  async applyStatusUpdates(updates: WhatsAppStatusUpdate[]) {
    let applied = 0;
    for (const update of updates) {
      const [message] = await db
        .select()
        .from(whatsappBlastMessages)
        .where(eq(whatsappBlastMessages.waMessageId, update.waMessageId))
        .limit(1);
      if (!message) continue;
      await db
        .update(whatsappBlastMessages)
        .set({
          status: update.status,
          failedReason: update.failedReason ?? message.failedReason,
        })
        .where(eq(whatsappBlastMessages.id, message.id));

      if (message.contactId) {
        const nextStatus =
          update.status === "failed"
            ? "pending"
            : update.status === "read"
              ? "read"
              : update.status === "delivered"
                ? "delivered"
                : "sent";
        const [contact] = await db
          .select()
          .from(whatsappContacts)
          .where(eq(whatsappContacts.id, message.contactId))
          .limit(1);
        if (contact && !["interested", "not_interested", "replied"].includes(contact.status)) {
          await db
            .update(whatsappContacts)
            .set({ status: nextStatus })
            .where(eq(whatsappContacts.id, contact.id));
        }
      }

      if (message.campaignId) {
        if (update.status === "delivered") {
          await db
            .update(whatsappCampaigns)
            .set({ deliveredCount: sql`${whatsappCampaigns.deliveredCount} + 1` })
            .where(eq(whatsappCampaigns.id, message.campaignId));
        } else if (update.status === "read") {
          await db
            .update(whatsappCampaigns)
            .set({ readCount: sql`${whatsappCampaigns.readCount} + 1` })
            .where(eq(whatsappCampaigns.id, message.campaignId));
        } else if (update.status === "failed") {
          await db
            .update(whatsappCampaigns)
            .set({ failedCount: sql`${whatsappCampaigns.failedCount} + 1` })
            .where(eq(whatsappCampaigns.id, message.campaignId));
        }
      }
      applied += 1;
    }
    return applied;
  },

  async handleInbound(messages: WhatsAppInboundMessage[]) {
    let handled = 0;
    for (const incoming of messages) {
      const formatted = formatIndianWhatsAppPhone(incoming.from);
      if (!formatted) continue;

      const last10 = formatted.slice(-10);
      const [contact] = await db
        .select()
        .from(whatsappContacts)
        .where(
          and(
            eq(whatsappContacts.orgId, SINGLE_TENANT_ORG_ID),
            or(
              eq(whatsappContacts.phone, formatted),
              sql`right(regexp_replace(${whatsappContacts.phone}, '\\D', '', 'g'), 10) = ${last10}`,
            ),
          ),
        )
        .orderBy(desc(whatsappContacts.lastOutboundAt), desc(whatsappContacts.createdAt))
        .limit(1);
      if (!contact) continue;

      const existing = incoming.waMessageId
        ? await db
            .select({ id: whatsappBlastMessages.id })
            .from(whatsappBlastMessages)
            .where(eq(whatsappBlastMessages.waMessageId, incoming.waMessageId))
            .limit(1)
        : [];
      if (existing[0]) continue;

      await db.insert(whatsappBlastMessages).values({
        orgId: SINGLE_TENANT_ORG_ID,
        campaignId: contact.campaignId,
        contactId: contact.id,
        waMessageId: incoming.waMessageId,
        direction: "inbound",
        type: incoming.type === "text" ? "text" : "button_reply",
        content: incoming.text || incoming.buttonId || "",
        status: "delivered",
        leadId: contact.leadId,
      });

      const wasReplied = ["replied", "interested", "not_interested"].includes(contact.status);
      await db
        .update(whatsappContacts)
        .set({
          lastInboundAt: new Date(),
          unreadCount: sql`${whatsappContacts.unreadCount} + 1`,
          status: wasReplied ? contact.status : "replied",
        })
        .where(eq(whatsappContacts.id, contact.id));

      if (!wasReplied) {
        await db
          .update(whatsappCampaigns)
          .set({ repliedCount: sql`${whatsappCampaigns.repliedCount} + 1` })
          .where(eq(whatsappCampaigns.id, contact.campaignId));
      }

      const campaign = await getCampaignOrThrow(contact.campaignId);
      const template = await getTemplateForCampaign(campaign);
      const payload = incoming.buttonId || incoming.text;
      const buttonAction = matchButtonAction(template.buttons, payload);

      if (buttonAction === "interested" || detectInterestedIntent(incoming.text)) {
        await this.markInterested(contact.id);
      } else if (buttonAction === "not_interested" || detectNotInterestedIntent(incoming.text)) {
        await this.markNotInterested(contact.id);
      } else if (buttonAction === "call_me_back" || detectCallBackIntent(incoming.text)) {
        await this.requestCallback(contact.id);
      } else if (contact.currentQuestionId) {
        await this.advanceQuestionFlow(contact.id, payload);
      }

      handled += 1;
    }
    return handled;
  },

  async markInterested(contactId: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact) throw notFound("Contact not found");
    const campaign = await getCampaignOrThrow(contact.campaignId);
    const template = await getTemplateForCampaign(campaign);
    const now = new Date();

    let leadId = contact.leadId;
    if (!leadId) {
      const leadCode = await allocateWhatsAppLeadCode();
      const [lead] = await db
        .insert(whatsappLeads)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          leadCode,
          campaignId: campaign.id,
          contactId: contact.id,
          contactPhone: contact.phone,
          name: contact.name,
          allAnswers: contact.questionAnswers ?? {},
          sourceCampaign: campaign.name,
          propertyName: campaign.propertyName,
          assignedAgentId: campaign.assignedAgentId,
          status: "new",
          interestAt: now,
        })
        .returning();
      leadId = lead!.id;
      await db
        .update(whatsappCampaigns)
        .set({
          interestedCount: sql`${whatsappCampaigns.interestedCount} + 1`,
          leadsGenerated: sql`${whatsappCampaigns.leadsGenerated} + 1`,
        })
        .where(eq(whatsappCampaigns.id, campaign.id));
      await notifyAgent(campaign.assignedAgentId, NOTIFICATION_TYPES.NEW_AD_LEAD, {
        leadName: contact.name,
        sourceLabel: "WhatsApp",
        campaignName: campaign.name,
        phone: contact.phone,
      });
    }

    const start = findQuestion(template.questionFlow, template.questionFlow.startQuestionId);
    await db
      .update(whatsappContacts)
      .set({
        status: "interested",
        interestClickedAt: contact.interestClickedAt ?? now,
        leadId,
        currentQuestionId: start?.id ?? null,
      })
      .where(eq(whatsappContacts.id, contact.id));

    if (start) {
      try {
        const sent = await sendWhatsAppInteractiveButtons({
          to: contact.phone,
          body: start.text,
          buttons: start.options.map((o) => ({ id: o.id, title: o.label })),
        }).catch(async () =>
          sendTextToContact(
            contact.phone,
            `${start.text}\n${start.options.map((o) => `• ${o.label}`).join("\n")}`,
          ),
        );
        await recordOutbound({
          campaignId: campaign.id,
          contactId: contact.id,
          type: "text",
          content: start.text,
          status: "sent",
          waMessageId: sent.waMessageId,
          leadId,
        });
      } catch (error) {
        logger.warn("Failed to send qualification question", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { leadId };
  },

  async markNotInterested(contactId: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact) throw notFound("Contact not found");
    if (contact.status !== "not_interested") {
      await db
        .update(whatsappCampaigns)
        .set({ notInterestedCount: sql`${whatsappCampaigns.notInterestedCount} + 1` })
        .where(eq(whatsappCampaigns.id, contact.campaignId));
    }
    await db
      .update(whatsappContacts)
      .set({ status: "not_interested", currentQuestionId: null })
      .where(eq(whatsappContacts.id, contactId));
    if (contact.leadId) {
      await db
        .update(whatsappLeads)
        .set({ status: "lost", updatedAt: new Date() })
        .where(eq(whatsappLeads.id, contact.leadId));
    }
  },

  async requestCallback(contactId: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact) throw notFound("Contact not found");
    const campaign = await getCampaignOrThrow(contact.campaignId);
    await this.markInterested(contactId);
    await notifyAgent(campaign.assignedAgentId, NOTIFICATION_TYPES.CALLBACK_REQUESTED, {
      leadName: contact.name,
      phone: contact.phone,
      campaignName: campaign.name,
      message: `${contact.name} asked to be called back from WhatsApp`,
    });
    try {
      const sent = await sendTextToContact(
        contact.phone,
        "Thanks! 📞 An advisor will call you back shortly.",
      );
      await recordOutbound({
        campaignId: campaign.id,
        contactId: contact.id,
        type: "text",
        content: "Thanks! 📞 An advisor will call you back shortly.",
        status: "sent",
        waMessageId: sent.waMessageId,
      });
    } catch {
      // ignore send failure after notifying agent
    }
  },

  async advanceQuestionFlow(contactId: string, answer: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact?.currentQuestionId) return;
    const campaign = await getCampaignOrThrow(contact.campaignId);
    const template = await getTemplateForCampaign(campaign);
    const result = nextQuestionAfterAnswer(
      template.questionFlow,
      contact.currentQuestionId,
      answer,
    );
    if (!result.option) return;

    const answers = {
      ...(contact.questionAnswers ?? {}),
      [contact.currentQuestionId]: result.option.label,
    } as Record<string, unknown>;
    if (result.option.mapsTo) {
      answers[result.option.mapsTo] = result.option.label;
    }

    const patch: Partial<typeof whatsappLeads.$inferInsert> = {
      allAnswers: answers,
      updatedAt: new Date(),
    };
    if (result.option.mapsTo === "budget") patch.budgetAnswer = result.option.label;
    if (result.option.mapsTo === "location") patch.locationAnswer = result.option.label;
    if (result.option.mapsTo === "timeline") patch.timelineAnswer = result.option.label;

    if (contact.leadId) {
      await db.update(whatsappLeads).set(patch).where(eq(whatsappLeads.id, contact.leadId));
    }

    if (result.completed || !result.nextQuestion) {
      await db
        .update(whatsappContacts)
        .set({
          questionAnswers: answers,
          currentQuestionId: null,
          flowCompletedAt: new Date(),
        })
        .where(eq(whatsappContacts.id, contact.id));
      try {
        const sent = await sendTextToContact(contact.phone, template.thankYouMessage);
        await recordOutbound({
          campaignId: campaign.id,
          contactId: contact.id,
          type: "text",
          content: template.thankYouMessage,
          status: "sent",
          waMessageId: sent.waMessageId,
          leadId: contact.leadId,
        });
      } catch {
        // thank-you is best-effort
      }
      return;
    }

    await db
      .update(whatsappContacts)
      .set({
        questionAnswers: answers,
        currentQuestionId: result.nextQuestion.id,
      })
      .where(eq(whatsappContacts.id, contact.id));

    try {
      const next = result.nextQuestion;
      const sent = await sendWhatsAppInteractiveButtons({
        to: contact.phone,
        body: next.text,
        buttons: next.options.map((o) => ({ id: o.id, title: o.label })),
      }).catch(() =>
        sendTextToContact(
          contact.phone,
          `${next.text}\n${next.options.map((o) => `• ${o.label}`).join("\n")}`,
        ),
      );
      await recordOutbound({
        campaignId: campaign.id,
        contactId: contact.id,
        type: "text",
        content: next.text,
        status: "sent",
        waMessageId: sent.waMessageId,
        leadId: contact.leadId,
      });
    } catch (error) {
      logger.warn("Failed to send next qualification question", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async unreadCount(agentId?: string, role?: string) {
    const conditions = [
      eq(whatsappContacts.orgId, SINGLE_TENANT_ORG_ID),
      sql`${whatsappContacts.unreadCount} > 0`,
    ];
    if (role === "agent" && agentId) {
      const rows = await db
        .select({ count: sql<number>`coalesce(sum(${whatsappContacts.unreadCount}), 0)::int` })
        .from(whatsappContacts)
        .innerJoin(whatsappCampaigns, eq(whatsappContacts.campaignId, whatsappCampaigns.id))
        .where(and(...conditions, eq(whatsappCampaigns.assignedAgentId, agentId)));
      return rows[0]?.count ?? 0;
    }
    const [row] = await db
      .select({ count: sql<number>`coalesce(sum(${whatsappContacts.unreadCount}), 0)::int` })
      .from(whatsappContacts)
      .where(and(...conditions));
    return row?.count ?? 0;
  },

  async listInbox(agentId?: string, role?: string) {
    const filters = [
      eq(whatsappContacts.orgId, SINGLE_TENANT_ORG_ID),
      isNotNull(whatsappContacts.lastInboundAt),
    ];
    if (role === "agent" && agentId) {
      filters.push(eq(whatsappCampaigns.assignedAgentId, agentId));
    }
    const rows = await db
      .select({
        contact: whatsappContacts,
        campaign: {
          id: whatsappCampaigns.id,
          name: whatsappCampaigns.name,
          campaignCode: whatsappCampaigns.campaignCode,
          assignedAgentId: whatsappCampaigns.assignedAgentId,
        },
      })
      .from(whatsappContacts)
      .innerJoin(whatsappCampaigns, eq(whatsappContacts.campaignId, whatsappCampaigns.id))
      .where(and(...filters))
      .orderBy(desc(whatsappContacts.lastInboundAt));

    return rows.map((row) => ({
      ...serializeContact(row.contact),
      campaignName: row.campaign.name,
      campaignCode: row.campaign.campaignCode,
      assignedAgentId: row.campaign.assignedAgentId,
    }));
  },

  async listMessages(contactId: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact) throw notFound("Conversation not found");
    const rows = await db
      .select()
      .from(whatsappBlastMessages)
      .where(eq(whatsappBlastMessages.contactId, contactId))
      .orderBy(asc(whatsappBlastMessages.createdAt));
    await db
      .update(whatsappContacts)
      .set({ unreadCount: 0 })
      .where(eq(whatsappContacts.id, contactId));
    return { contact: serializeContact(contact), items: rows.map(serializeMessage) };
  },

  async replyToContact(contactId: string, text: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact) throw notFound("Conversation not found");
    const sent = await sendTextToContact(contact.phone, text);
    const message = await recordOutbound({
      campaignId: contact.campaignId,
      contactId: contact.id,
      type: "text",
      content: text,
      status: "sent",
      waMessageId: sent.waMessageId,
      leadId: contact.leadId,
    });
    await db
      .update(whatsappContacts)
      .set({ lastOutboundAt: new Date() })
      .where(eq(whatsappContacts.id, contact.id));
    return serializeMessage(message);
  },

  async assignContact(contactId: string, agentId: string) {
    const [contact] = await db
      .select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.id, contactId))
      .limit(1);
    if (!contact) throw notFound("Contact not found");
    await db
      .update(whatsappCampaigns)
      .set({ assignedAgentId: agentId, updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, contact.campaignId));
    if (contact.leadId) {
      await db
        .update(whatsappLeads)
        .set({ assignedAgentId: agentId, updatedAt: new Date() })
        .where(eq(whatsappLeads.id, contact.leadId));
    }
  },

  async listWhatsAppLeads(agentId?: string, role?: string) {
    const filters = [eq(whatsappLeads.orgId, SINGLE_TENANT_ORG_ID)];
    if (role === "agent" && agentId) {
      filters.push(eq(whatsappLeads.assignedAgentId, agentId));
    }
    const rows = await db
      .select({
        lead: whatsappLeads,
        agentName: users.name,
      })
      .from(whatsappLeads)
      .leftJoin(users, eq(whatsappLeads.assignedAgentId, users.id))
      .where(and(...filters))
      .orderBy(desc(whatsappLeads.interestAt));

    return rows.map((row) => ({
      ...serializeLead(row.lead),
      assignedAgentName: row.agentName,
    }));
  },

  async getWhatsAppLead(id: string) {
    const [row] = await db
      .select()
      .from(whatsappLeads)
      .where(and(eq(whatsappLeads.orgId, SINGLE_TENANT_ORG_ID), eq(whatsappLeads.id, id)))
      .limit(1);
    if (!row) throw notFound("WhatsApp lead not found");
    const messages = row.contactId
      ? await db
          .select()
          .from(whatsappBlastMessages)
          .where(eq(whatsappBlastMessages.contactId, row.contactId))
          .orderBy(asc(whatsappBlastMessages.createdAt))
      : [];
    return { ...serializeLead(row), transcript: messages.map(serializeMessage) };
  },

  async convertWhatsAppLead(id: string, actingUserId: string) {
    const [waLead] = await db
      .select()
      .from(whatsappLeads)
      .where(and(eq(whatsappLeads.orgId, SINGLE_TENANT_ORG_ID), eq(whatsappLeads.id, id)))
      .limit(1);
    if (!waLead) throw notFound("WhatsApp lead not found");
    if (waLead.convertedToLeadId) {
      return { leadId: waLead.convertedToLeadId, alreadyConverted: true };
    }

    const nameParts = waLead.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "WhatsApp";
    const lastName = nameParts.slice(1).join(" ");
    const notes = [
      `Converted from WhatsApp Blaster (${waLead.leadCode})`,
      waLead.sourceCampaign ? `Campaign: ${waLead.sourceCampaign}` : null,
      waLead.propertyName ? `Property: ${waLead.propertyName}` : null,
      waLead.budgetAnswer ? `Budget: ${waLead.budgetAnswer}` : null,
      waLead.locationAnswer ? `Location: ${waLead.locationAnswer}` : null,
      waLead.timelineAnswer ? `Timeline: ${waLead.timelineAnswer}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const existing = await leadService.lookupByPhone(waLead.contactPhone);
    let crmLeadId = existing?.id ?? null;
    if (!crmLeadId) {
      const created = await leadService.createLead(
        {
          firstName,
          lastName,
          phone: waLead.contactPhone,
          city: waLead.locationAnswer ?? undefined,
          leadSource: WHATSAPP_BLAST_LEAD_SOURCE,
          leadStatus: "new",
          temperature: "hot",
          notes,
          projectName: waLead.propertyName ?? undefined,
        },
        { assignedTo: waLead.assignedAgentId ?? actingUserId },
      );
      crmLeadId = created.id;
    }

    await db
      .update(whatsappLeads)
      .set({
        status: "converted",
        convertedToLeadId: crmLeadId,
        updatedAt: new Date(),
      })
      .where(eq(whatsappLeads.id, id));

    return { leadId: crmLeadId, alreadyConverted: Boolean(existing) };
  },

  async reportsSummary() {
    const [row] = await db
      .select({
        campaigns: sql<number>`count(*)::int`,
        sent: sql<number>`coalesce(sum(${whatsappCampaigns.sentCount}), 0)::int`,
        delivered: sql<number>`coalesce(sum(${whatsappCampaigns.deliveredCount}), 0)::int`,
        interested: sql<number>`coalesce(sum(${whatsappCampaigns.interestedCount}), 0)::int`,
        leads: sql<number>`coalesce(sum(${whatsappCampaigns.leadsGenerated}), 0)::int`,
      })
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.orgId, SINGLE_TENANT_ORG_ID));

    const sent = row?.sent ?? 0;
    const delivered = row?.delivered ?? 0;
    const interested = row?.interested ?? 0;
    return {
      totalCampaigns: row?.campaigns ?? 0,
      totalMessagesSent: sent,
      overallDeliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
      overallInterestRate: sent > 0 ? Math.round((interested / sent) * 1000) / 10 : 0,
      totalLeadsGenerated: row?.leads ?? 0,
      provider: providerInfo(),
    };
  },

  async campaignReport(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);
    const leadsRows = await db
      .select({
        lead: whatsappLeads,
        agentName: users.name,
      })
      .from(whatsappLeads)
      .leftJoin(users, eq(whatsappLeads.assignedAgentId, users.id))
      .where(eq(whatsappLeads.campaignId, campaignId));

    const template = campaign.template;
    const flow = template?.questionFlow ?? DEFAULT_WHATSAPP_QUESTION_FLOW;
    const questionBreakdown = flow.questions.map((question) => {
      const counts = new Map<string, number>();
      for (const row of leadsRows) {
        const answers = row.lead.allAnswers as Record<string, unknown>;
        const value = answers[question.id] ?? answers[question.options[0]?.mapsTo ?? ""];
        if (typeof value === "string" && value) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
      return {
        questionId: question.id,
        questionText: question.text,
        answers: question.options.map((opt) => {
          const count = counts.get(opt.label) ?? 0;
          return { label: opt.label, count, percent: Math.round((count / total) * 100) };
        }),
      };
    });

    const agentMap = new Map<string, { agentId: string; name: string; count: number }>();
    for (const row of leadsRows) {
      const key = row.lead.assignedAgentId ?? "unassigned";
      const current = agentMap.get(key) ?? {
        agentId: key,
        name: row.agentName ?? "Unassigned",
        count: 0,
      };
      current.count += 1;
      agentMap.set(key, current);
    }

    const inbound = await db
      .select({ createdAt: whatsappBlastMessages.createdAt })
      .from(whatsappBlastMessages)
      .where(
        and(
          eq(whatsappBlastMessages.campaignId, campaignId),
          eq(whatsappBlastMessages.direction, "inbound"),
        ),
      );
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, replies: 0 }));
    for (const msg of inbound) {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          hour12: false,
        }).format(msg.createdAt),
      );
      if (hours[hour]) hours[hour].replies += 1;
    }

    return {
      campaign,
      funnel: {
        sent: campaign.sentCount,
        delivered: campaign.deliveredCount,
        read: campaign.readCount,
        replied: campaign.repliedCount,
        interested: campaign.interestedCount,
        leads: campaign.leadsGenerated,
      },
      questionBreakdown,
      leads: leadsRows.map((row) => ({
        ...serializeLead(row.lead),
        assignedAgentName: row.agentName,
      })),
      agentDistribution: [...agentMap.values()],
      timeOfDay: hours,
    };
  },

  async exportCampaignCsv(campaignId: string) {
    const contacts = await this.listContacts(campaignId);
    const header = ["name", "phone", "city", "budget", "status", "interested_at", "answers"];
    const lines = [header.join(",")];
    for (const c of contacts) {
      const answers = JSON.stringify(c.questionAnswers).replaceAll('"', '""');
      lines.push(
        [
          csvCell(c.name),
          csvCell(c.phone),
          csvCell(c.city ?? ""),
          csvCell(c.budget ?? ""),
          csvCell(c.status),
          csvCell(c.interestClickedAt ?? ""),
          `"${answers}"`,
        ].join(","),
      );
    }
    return lines.join("\n");
  },

  async exportReportPdf(campaignId: string) {
    const report = await this.campaignReport(campaignId);
    const PDFDocument = (await import("pdfkit")).default;
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.fontSize(18).text("WhatsApp Campaign Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`${report.campaign.campaignCode} — ${report.campaign.name}`);
      doc.text(
        `Sent: ${report.funnel.sent}  Delivered: ${report.funnel.delivered}  Interested: ${report.funnel.interested}`,
      );
      doc.text(`Leads generated: ${report.funnel.leads}`);
      doc.moveDown();
      for (const q of report.questionBreakdown) {
        doc.fontSize(11).text(q.questionText);
        for (const a of q.answers) {
          doc.fontSize(10).text(`  ${a.label}: ${a.count} (${a.percent}%)`);
        }
        doc.moveDown(0.5);
      }
      doc.end();
    });
  },
};

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
