import { leads, users, whatsappMessages, whatsappTemplates } from "@propninja/db";
import { and, desc, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import {
  type WhatsAppStatusUpdate,
  buildTemplateComponents,
  extractTemplateVariables,
  fetchMetaMessageTemplates,
  isWhatsAppConfigured,
  normalizeTemplateCategory,
  sendWhatsAppTemplate,
} from "../lib/whatsapp.js";

export type SendWhatsAppMessageInput = {
  leadId: string;
  templateId: string;
  sentBy: string;
  variables: Record<string, string>;
};

function defaultVariableValues(lead: {
  firstName: string;
  lastName: string;
  phone: string | null;
  projectName: string | null;
  city: string | null;
}) {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  return {
    name: fullName,
    first_name: lead.firstName,
    last_name: lead.lastName,
    phone: lead.phone ?? "",
    property: lead.projectName ?? "",
    project: lead.projectName ?? "",
    city: lead.city ?? "",
  };
}

export const whatsappService = {
  isConfigured: isWhatsAppConfigured,

  async listActiveTemplates() {
    return db
      .select()
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.orgId, SINGLE_TENANT_ORG_ID),
          eq(whatsappTemplates.isActive, true),
        ),
      )
      .orderBy(whatsappTemplates.name);
  },

  async listAllTemplates() {
    return db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(whatsappTemplates.name);
  },

  async getTemplateById(templateId: string) {
    const [row] = await db
      .select()
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.orgId, SINGLE_TENANT_ORG_ID),
          eq(whatsappTemplates.id, templateId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async syncTemplatesFromMeta() {
    const metaTemplates = await fetchMetaMessageTemplates();
    const now = new Date();
    let upserted = 0;

    for (const meta of metaTemplates) {
      if (meta.status && meta.status !== "APPROVED") continue;

      const templateName = meta.name?.trim();
      if (!templateName) continue;

      const language = meta.language?.trim() || "en";
      const variables = extractTemplateVariables(meta.components);
      const category = normalizeTemplateCategory(meta.category);
      const displayName = templateName.replace(/_/g, " ");

      await db
        .insert(whatsappTemplates)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          name: displayName,
          templateName,
          language,
          category,
          variables,
          isActive: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            whatsappTemplates.orgId,
            whatsappTemplates.templateName,
            whatsappTemplates.language,
          ],
          set: {
            name: displayName,
            category,
            variables,
            isActive: true,
            updatedAt: now,
          },
        });

      upserted += 1;
    }

    return { upserted, checked: metaTemplates.length };
  },

  async sendTemplateMessage(input: SendWhatsAppMessageInput) {
    if (!isWhatsAppConfigured()) {
      throw new Error("WhatsApp API is not configured");
    }

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, input.leadId)))
      .limit(1);

    if (!lead) {
      throw notFound("Lead not found");
    }

    if (!lead.phone?.trim()) {
      throw new Error("Lead has no phone number");
    }

    const template = await this.getTemplateById(input.templateId);
    if (!template || !template.isActive) {
      throw notFound("Template not found");
    }

    const variableKeys = template.variables ?? [];
    const mergedVariables = {
      ...defaultVariableValues(lead),
      ...input.variables,
    };

    const components = buildTemplateComponents(variableKeys, mergedVariables);

    const { waMessageId } = await sendWhatsAppTemplate({
      to: lead.phone,
      templateName: template.templateName,
      language: template.language,
      components,
    });

    const now = new Date();
    const [message] = await db
      .insert(whatsappMessages)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: lead.id,
        sentBy: input.sentBy,
        templateId: template.id,
        variables: mergedVariables,
        waMessageId,
        status: "sent",
        sentAt: now,
      })
      .returning();

    return message!;
  },

  async listLeadMessages(leadId: string) {
    const rows = await db
      .select({
        message: whatsappMessages,
        template: {
          id: whatsappTemplates.id,
          name: whatsappTemplates.name,
          templateName: whatsappTemplates.templateName,
        },
        sender: {
          id: users.id,
          name: users.name,
        },
      })
      .from(whatsappMessages)
      .innerJoin(whatsappTemplates, eq(whatsappMessages.templateId, whatsappTemplates.id))
      .leftJoin(users, eq(whatsappMessages.sentBy, users.id))
      .where(
        and(eq(whatsappMessages.orgId, SINGLE_TENANT_ORG_ID), eq(whatsappMessages.leadId, leadId)),
      )
      .orderBy(desc(whatsappMessages.sentAt));

    return rows.map((row) => ({
      ...row.message,
      template: row.template,
      sender: row.sender?.id ? row.sender : null,
    }));
  },

  async applyStatusUpdates(updates: WhatsAppStatusUpdate[]) {
    let applied = 0;

    for (const update of updates) {
      const timestamp = update.timestamp ? new Date(update.timestamp * 1000) : new Date();
      const patch: Partial<typeof whatsappMessages.$inferInsert> = {
        status: update.status,
      };

      if (update.status === "delivered") {
        patch.deliveredAt = timestamp;
      } else if (update.status === "read") {
        patch.readAt = timestamp;
        patch.deliveredAt = patch.deliveredAt ?? timestamp;
      } else if (update.status === "failed") {
        patch.failedReason = update.failedReason ?? "Delivery failed";
      }

      const [row] = await db
        .update(whatsappMessages)
        .set(patch)
        .where(
          and(
            eq(whatsappMessages.orgId, SINGLE_TENANT_ORG_ID),
            eq(whatsappMessages.waMessageId, update.waMessageId),
          ),
        )
        .returning({ id: whatsappMessages.id });

      if (row) applied += 1;
    }

    return applied;
  },
};
