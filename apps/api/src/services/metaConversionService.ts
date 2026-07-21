/**
 * Meta Conversions API (CAPI) event pipeline: records an auditable, dedup-safe
 * `facebook_conversion_events` row per CRM lifecycle transition and sends
 * pending events to Meta in batches (grouped by pixel).
 */
import { facebookConversionEvents, facebookPixels, leads } from "@propninja/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import {
  type CapiEvent,
  buildCapiUserData,
  generateEventId,
  sendCapiEvents,
} from "../lib/metaCapi.js";
import { mapLeadStatusToCapiEvent } from "../lib/metaStatusMap.js";
import { decryptSecret } from "../lib/tokenEncryption.js";
import { getActiveAccessToken } from "./metaTokenService.js";

export type EnqueueConversionResult =
  | { sent: false; skipped: true; reason: string }
  | { sent: true; eventId: string; recordId: string };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

async function resolveDefaultPixel(orgId: string) {
  const [pixel] = await db
    .select()
    .from(facebookPixels)
    .where(
      and(
        eq(facebookPixels.orgId, orgId),
        eq(facebookPixels.isActive, true),
        eq(facebookPixels.isSelected, true),
      ),
    )
    .orderBy(desc(facebookPixels.isDefault))
    .limit(1);
  return pixel ?? null;
}

/**
 * Records (and best-effort sends) a CAPI conversion event for a lead status
 * transition. Maps `status` → CAPI event name via `metaStatusMap`; skips
 * silently for statuses with no advertiser-meaningful event, or when
 * `META_CAPI_ENABLED` is off, or when no pixel is configured.
 */
export async function enqueueConversionForLeadStatusChange(
  leadId: string,
  status: string,
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<EnqueueConversionResult> {
  if (!env.META_CAPI_ENABLED) {
    return { sent: false, skipped: true, reason: "capi_disabled" };
  }

  const eventName = mapLeadStatusToCapiEvent(status);
  if (!eventName) {
    return { sent: false, skipped: true, reason: "no_event_mapping" };
  }

  const [lead] = await db
    .select({
      id: leads.id,
      email: leads.email,
      phone: leads.phone,
      firstName: leads.firstName,
      lastName: leads.lastName,
      city: leads.city,
      state: leads.state,
      country: leads.country,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.orgId, orgId)))
    .limit(1);

  if (!lead) {
    return { sent: false, skipped: true, reason: "lead_not_found" };
  }

  const pixel = await resolveDefaultPixel(orgId);
  if (!pixel) {
    logger.warn("Meta CAPI event skipped — no active pixel configured", { orgId, leadId });
    return { sent: false, skipped: true, reason: "no_pixel" };
  }

  const eventId = generateEventId(`lead-${leadId}`);
  const userData = buildCapiUserData({
    email: lead.email,
    phone: lead.phone,
    firstName: lead.firstName,
    lastName: lead.lastName,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    externalId: lead.id,
  });

  let recordId: string;
  try {
    const [inserted] = await db
      .insert(facebookConversionEvents)
      .values({
        orgId,
        leadId: lead.id,
        pixelId: pixel.pixelId,
        eventName,
        eventId,
        eventTime: new Date(),
        actionSource: "system_generated",
        userData,
        customData: { leadId: lead.id, leadStatus: status },
        status: "pending",
      })
      .returning({ id: facebookConversionEvents.id });
    recordId = inserted!.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { sent: false, skipped: true, reason: "duplicate_event_id" };
    }
    throw error;
  }

  try {
    const { isDurableJobsEnabled, enqueueMetaCapiSend } = await import("../lib/jobQueue.js");
    if (isDurableJobsEnabled()) {
      await enqueueMetaCapiSend();
    } else {
      await sendPendingConversionEvents();
    }
  } catch (error) {
    logger.error("Failed to dispatch Meta CAPI send", {
      leadId,
      recordId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { sent: true, eventId, recordId };
}

function toCapiEventPayload(row: typeof facebookConversionEvents.$inferSelect): CapiEvent {
  return {
    event_name: row.eventName,
    event_time: Math.floor(row.eventTime.getTime() / 1000),
    event_id: row.eventId,
    action_source: (row.actionSource as CapiEvent["action_source"]) ?? "system_generated",
    event_source_url: row.eventSourceUrl ?? undefined,
    user_data: row.userData as CapiEvent["user_data"],
    custom_data: row.customData,
  };
}

async function resolvePixelAccessToken(orgId: string, pixelId: string): Promise<string | null> {
  const [pixel] = await db
    .select({ accessTokenEncrypted: facebookPixels.accessTokenEncrypted })
    .from(facebookPixels)
    .where(and(eq(facebookPixels.orgId, orgId), eq(facebookPixels.pixelId, pixelId)))
    .limit(1);

  if (pixel?.accessTokenEncrypted) {
    return decryptSecret(pixel.accessTokenEncrypted);
  }

  return getActiveAccessToken(orgId);
}

/** Sends up to `limit` pending conversion events to Meta, grouped by pixel. */
export async function sendPendingConversionEvents(
  options: { orgId?: string; limit?: number } = {},
): Promise<{ sent: number; failed: number }> {
  const orgId = options.orgId ?? SINGLE_TENANT_ORG_ID;
  const limit = options.limit ?? 50;

  const pending = await db
    .select()
    .from(facebookConversionEvents)
    .where(
      and(
        eq(facebookConversionEvents.orgId, orgId),
        eq(facebookConversionEvents.status, "pending"),
      ),
    )
    .orderBy(facebookConversionEvents.createdAt)
    .limit(limit);

  if (pending.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const byPixel = new Map<string, typeof pending>();
  for (const row of pending) {
    byPixel.set(row.pixelId, [...(byPixel.get(row.pixelId) ?? []), row]);
  }

  let sent = 0;
  let failed = 0;

  for (const [pixelId, rows] of byPixel.entries()) {
    const accessToken = await resolvePixelAccessToken(orgId, pixelId);
    const ids = rows.map((r) => r.id);

    if (!accessToken) {
      failed += rows.length;
      await db
        .update(facebookConversionEvents)
        .set({
          status: "failed",
          errorMessage: "No Meta access token available",
          updatedAt: new Date(),
        })
        .where(inArray(facebookConversionEvents.id, ids));
      continue;
    }

    const result = await sendCapiEvents(pixelId, accessToken, rows.map(toCapiEventPayload), {
      testEventCode: process.env.META_CAPI_TEST_EVENT_CODE,
    });

    if (result.ok) {
      sent += rows.length;
      await db
        .update(facebookConversionEvents)
        .set({
          status: "sent",
          httpStatus: result.status,
          responsePayload: { eventsReceived: result.eventsReceived, fbtraceId: result.fbtraceId },
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(facebookConversionEvents.id, ids));
    } else {
      failed += rows.length;
      await db
        .update(facebookConversionEvents)
        .set({
          status: "failed",
          httpStatus: result.status,
          errorMessage: result.error,
          updatedAt: new Date(),
        })
        .where(inArray(facebookConversionEvents.id, ids));
      logger.error("Meta CAPI send failed", { pixelId, error: result.error });
    }
  }

  return { sent, failed };
}
