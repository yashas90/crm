import { randomUUID } from "node:crypto";
import { leadActivities, leads, portalWebhooks, users } from "@propninja/db";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { normalizeStoredPhone, phoneMatchVariants } from "../lib/leadPhone.js";
import { logger } from "../lib/logger.js";
import {
  PORTAL_LEAD_SOURCE_LABELS,
  type PortalName,
  resolvePortalFieldMapping,
} from "../lib/portalWebhookDefaults.js";
import { applyPortalFieldMapping, splitFullName } from "../lib/portalWebhookMapping.js";
import { incrementRateLimit } from "../lib/rateLimitStore.js";
import type { CreateLeadInput } from "../lib/validators/leads.js";
import { createLeadBodySchema } from "../lib/validators/leads.js";
import { portalMappedLeadSchema } from "../lib/validators/portalWebhook.js";
import { logAudit } from "./auditService.js";
import { leadService } from "./leadService.js";
import { SECURITY_ALERT_TYPES, createSecurityAlert } from "./securityAlertService.js";

const PORTAL_BURST_LIMIT = 100;
const PORTAL_BURST_WINDOW_MS = 10 * 60_000;

type PortalWebhookRow = typeof portalWebhooks.$inferSelect;

export type PortalWebhookDto = {
  id: string;
  portalName: PortalName;
  webhookToken: string;
  fieldMapping: Record<string, string>;
  isActive: boolean;
  lastLeadReceivedAt: string | null;
  createdAt: string;
  webhookUrl: string;
};

export type PortalLeadPreview = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  leadSource: string;
  projectName: string | null;
  notes: string | null;
  merged: boolean;
  existingLeadId: string | null;
};

function buildWebhookUrl(token: string, baseUrl?: string): string {
  const base = (
    baseUrl ??
    env.PUBLIC_API_BASE_URL ??
    "https://crm-production.up.railway.app"
  ).replace(/\/$/, "");
  return `${base}/api/integrations/portal/${token}`;
}

function toDto(row: PortalWebhookRow, baseUrl?: string): PortalWebhookDto {
  return {
    id: row.id,
    portalName: row.portalName as PortalName,
    webhookToken: row.webhookToken,
    fieldMapping: row.fieldMapping,
    isActive: row.isActive,
    lastLeadReceivedAt: row.lastLeadReceivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    webhookUrl: buildWebhookUrl(row.webhookToken, baseUrl),
  };
}

async function resolveAuditUserId(db: Database): Promise<string> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
    .limit(1);

  return admin?.id ?? env.DEMO_USER_ID;
}

async function findLeadByPhone(db: Database, phone: string) {
  const variants = phoneMatchVariants(phone);
  if (variants.length === 0) {
    return null;
  }

  const [row] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        or(...variants.map((variant) => eq(leads.phone, variant)))!,
      ),
    )
    .limit(1);

  return row ?? null;
}

function buildCreateLeadInput(
  mapped: ReturnType<typeof portalMappedLeadSchema.parse>,
  leadSource: string,
): CreateLeadInput {
  const { firstName, lastName } = splitFullName(mapped.name);
  return {
    firstName,
    lastName,
    phone: mapped.phone,
    email: mapped.email,
    leadSource,
    projectName: mapped.projectInterest,
    notes: mapped.message,
    tags: ["portal_lead", leadSource],
  };
}

function buildPreview(
  mapped: ReturnType<typeof portalMappedLeadSchema.parse>,
  leadSource: string,
  existingLeadId: string | null,
): PortalLeadPreview {
  const { firstName, lastName } = splitFullName(mapped.name);
  return {
    firstName,
    lastName,
    phone: normalizeStoredPhone(mapped.phone),
    email: mapped.email ?? null,
    leadSource,
    projectName: mapped.projectInterest ?? null,
    notes: mapped.message ?? null,
    merged: Boolean(existingLeadId),
    existingLeadId,
  };
}

async function recordPortalActivity(
  db: Database,
  leadId: string,
  portalName: PortalName,
  rawPayload: unknown,
) {
  await db.insert(leadActivities).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId,
    userId: null,
    type: "note",
    metadata: {
      kind: "portal_lead",
      portalName,
      ingestedAt: new Date().toISOString(),
      rawPayload,
    },
  });
}

async function checkBurstAndMaybePause(
  db: Database,
  webhook: PortalWebhookRow,
  ipAddress?: string | null,
): Promise<void> {
  const burstCount = await incrementRateLimit(`portal-burst:${webhook.id}`, PORTAL_BURST_WINDOW_MS);

  if (burstCount <= PORTAL_BURST_LIMIT) {
    return;
  }

  await db.update(portalWebhooks).set({ isActive: false }).where(eq(portalWebhooks.id, webhook.id));

  await createSecurityAlert(db, {
    alertType: SECURITY_ALERT_TYPES.PORTAL_WEBHOOK_FLOOD,
    details: {
      portalWebhookId: webhook.id,
      portalName: webhook.portalName,
      burstCount,
      windowMinutes: PORTAL_BURST_WINDOW_MS / 60_000,
    },
    ipAddress,
  });

  logger.warn("Portal webhook paused due to lead flood", {
    portalWebhookId: webhook.id,
    portalName: webhook.portalName,
    burstCount,
  });
}

export function createPortalWebhookService(db: Database) {
  return {
    async list(baseUrl?: string): Promise<PortalWebhookDto[]> {
      const rows = await db.select().from(portalWebhooks).orderBy(desc(portalWebhooks.createdAt));

      return rows.map((row) => toDto(row, baseUrl));
    },

    async create(
      input: { portalName: PortalName; fieldMapping?: Record<string, string> },
      baseUrl?: string,
    ): Promise<PortalWebhookDto> {
      const fieldMapping = resolvePortalFieldMapping(
        input.portalName,
        input.fieldMapping as Parameters<typeof resolvePortalFieldMapping>[1],
      );

      const [row] = await db
        .insert(portalWebhooks)
        .values({
          portalName: input.portalName,
          webhookToken: randomUUID(),
          fieldMapping,
          isActive: true,
        })
        .returning();

      return toDto(row!, baseUrl);
    },

    async update(
      id: string,
      input: { fieldMapping?: Record<string, string>; isActive?: boolean },
      baseUrl?: string,
    ): Promise<PortalWebhookDto> {
      const [existing] = await db
        .select()
        .from(portalWebhooks)
        .where(eq(portalWebhooks.id, id))
        .limit(1);

      if (!existing) {
        throw notFound("Portal webhook not found");
      }

      const update: Partial<typeof portalWebhooks.$inferInsert> = {};
      if (input.isActive !== undefined) {
        update.isActive = input.isActive;
      }
      if (input.fieldMapping) {
        update.fieldMapping = resolvePortalFieldMapping(
          existing.portalName as PortalName,
          input.fieldMapping as Parameters<typeof resolvePortalFieldMapping>[1],
        );
      }

      const [row] = await db
        .update(portalWebhooks)
        .set(update)
        .where(eq(portalWebhooks.id, id))
        .returning();

      return toDto(row!, baseUrl);
    },

    async getByToken(token: string): Promise<PortalWebhookRow | null> {
      const [row] = await db
        .select()
        .from(portalWebhooks)
        .where(eq(portalWebhooks.webhookToken, token))
        .limit(1);

      return row ?? null;
    },

    previewLead(input: {
      portalName: PortalName;
      fieldMapping?: Record<string, string>;
      payload: Record<string, unknown>;
    }): PortalLeadPreview {
      const mapping = resolvePortalFieldMapping(
        input.portalName,
        input.fieldMapping as Parameters<typeof resolvePortalFieldMapping>[1],
      );
      const mapped = applyPortalFieldMapping(input.payload, mapping);
      const parsed = portalMappedLeadSchema.safeParse(mapped);

      if (!parsed.success) {
        throw badRequest("Invalid mapped lead data", parsed.error.flatten());
      }

      const leadSource = PORTAL_LEAD_SOURCE_LABELS[input.portalName];
      return buildPreview(parsed.data, leadSource, null);
    },

    async ingestFromWebhook(
      webhook: PortalWebhookRow,
      payload: Record<string, unknown>,
      options?: { ipAddress?: string | null; dryRun?: boolean },
    ): Promise<{ received: true; preview?: PortalLeadPreview; leadId?: string }> {
      if (!webhook.isActive) {
        throw forbidden("Portal webhook is inactive");
      }

      if (!options?.dryRun) {
        await checkBurstAndMaybePause(db, webhook, options?.ipAddress);
        const refreshed = await this.getByToken(webhook.webhookToken);
        if (!refreshed?.isActive) {
          throw forbidden("Portal webhook paused due to high volume");
        }
      }

      const mapping = resolvePortalFieldMapping(
        webhook.portalName as PortalName,
        webhook.fieldMapping as Parameters<typeof resolvePortalFieldMapping>[1],
      );
      const mapped = applyPortalFieldMapping(payload, mapping);
      const parsed = portalMappedLeadSchema.safeParse(mapped);

      if (!parsed.success) {
        throw badRequest("Invalid lead data", parsed.error.flatten());
      }

      const leadSource = PORTAL_LEAD_SOURCE_LABELS[webhook.portalName as PortalName];
      const storedPhone = normalizeStoredPhone(parsed.data.phone);
      const existing = await findLeadByPhone(db, storedPhone);
      const preview = buildPreview(parsed.data, leadSource, existing?.id ?? null);

      if (options?.dryRun) {
        return { received: true, preview };
      }

      const createInput = buildCreateLeadInput(parsed.data, leadSource);
      const sanitized = createLeadBodySchema.safeParse(createInput);
      if (!sanitized.success) {
        throw badRequest("Invalid lead data", sanitized.error.flatten());
      }

      const auditUserId = await resolveAuditUserId(db);
      let leadId: string;

      if (existing) {
        const merged = await leadService.mergeImportRow({
          leadId: existing.id,
          data: sanitized.data,
          storedPhone,
          actingUserId: auditUserId,
        });

        if (!merged) {
          throw badRequest("Failed to merge duplicate lead");
        }

        leadId = merged.id;
        await recordPortalActivity(db, leadId, webhook.portalName as PortalName, payload);
      } else {
        const created = await leadService.createLead(sanitized.data);
        leadId = created.id;
        await recordPortalActivity(db, leadId, webhook.portalName as PortalName, payload);
      }

      await db
        .update(portalWebhooks)
        .set({ lastLeadReceivedAt: new Date() })
        .where(eq(portalWebhooks.id, webhook.id));

      await logAudit(db, {
        userId: auditUserId,
        action: AUDIT_ACTIONS.PORTAL_LEAD_RECEIVED,
        entityType: "lead",
        entityId: leadId,
        metadata: {
          portalName: webhook.portalName,
          portalWebhookId: webhook.id,
          merged: Boolean(existing),
        },
      });

      return { received: true, leadId };
    },
  };
}

export const portalWebhookService = createPortalWebhookService(db);
