import { messageTemplates } from "@propninja/db";
import type { MessageTemplateCategory } from "@propninja/types/message-templates";
import { and, asc, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";

export type MessageTemplateRow = {
  id: string;
  name: string;
  content: string;
  category: MessageTemplateCategory;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof messageTemplates.$inferSelect): MessageTemplateRow {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    category: row.category as MessageTemplateCategory,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createMessageTemplateService(db: Database) {
  return {
    async listActive(): Promise<MessageTemplateRow[]> {
      const rows = await db
        .select()
        .from(messageTemplates)
        .where(
          and(
            eq(messageTemplates.orgId, SINGLE_TENANT_ORG_ID),
            eq(messageTemplates.isActive, true),
          ),
        )
        .orderBy(asc(messageTemplates.name));

      return rows.map(mapRow);
    },

    async listAll(): Promise<MessageTemplateRow[]> {
      const rows = await db
        .select()
        .from(messageTemplates)
        .where(eq(messageTemplates.orgId, SINGLE_TENANT_ORG_ID))
        .orderBy(asc(messageTemplates.name));

      return rows.map(mapRow);
    },

    async create(input: {
      name: string;
      content: string;
      category: MessageTemplateCategory;
      createdBy: string;
    }): Promise<MessageTemplateRow> {
      const [row] = await db
        .insert(messageTemplates)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          name: input.name,
          content: input.content,
          category: input.category,
          createdBy: input.createdBy,
        })
        .returning();

      return mapRow(row);
    },

    async update(
      id: string,
      input: Partial<{
        name: string;
        content: string;
        category: MessageTemplateCategory;
        isActive: boolean;
      }>,
    ): Promise<MessageTemplateRow | null> {
      const [row] = await db
        .update(messageTemplates)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(messageTemplates.id, id), eq(messageTemplates.orgId, SINGLE_TENANT_ORG_ID)))
        .returning();

      return row ? mapRow(row) : null;
    },

    async deactivate(id: string): Promise<MessageTemplateRow | null> {
      return this.update(id, { isActive: false });
    },
  };
}

export const DEFAULT_MESSAGE_TEMPLATES: Array<{
  name: string;
  category: MessageTemplateCategory;
  content: string;
}> = [
  {
    name: "Greeting",
    category: "greeting",
    content:
      "Hi {{leadName}}, this is {{agentName}} from PropNinja. Thank you for your interest! How can I help you today?",
  },
  {
    name: "Project Details",
    category: "project_details",
    content:
      "Hi {{leadName}}, here are the details for {{projectName}}:\nUnit: {{unitNumber}}\nPrice: ₹{{priceListedRs}}\nLet me know if you'd like to schedule a site visit!",
  },
  {
    name: "Site Visit Reminder",
    category: "site_visit",
    content:
      "Hi {{leadName}}, just confirming your site visit for {{projectName}} tomorrow. Looking forward to seeing you!",
  },
  {
    name: "Follow Up",
    category: "follow_up",
    content:
      "Hi {{leadName}}, just checking in regarding {{projectName}}. Are you still interested? Happy to answer any questions.",
  },
  {
    name: "Thank You",
    category: "custom",
    content:
      "Thank you {{leadName}} for visiting {{projectName}} today! Let me know if you have any questions or would like to proceed further.",
  },
];

export async function seedDefaultMessageTemplates(db: Database, createdBy: string) {
  const existing = await db
    .select({ id: messageTemplates.id })
    .from(messageTemplates)
    .where(eq(messageTemplates.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);

  if (existing.length > 0) return;

  const service = createMessageTemplateService(db);
  for (const template of DEFAULT_MESSAGE_TEMPLATES) {
    await service.create({ ...template, createdBy });
  }
}
