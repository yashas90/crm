/**
 * Meta Conversions API (CAPI) event pipeline: records an auditable, dedup-safe
 * `facebook_conversion_events` row per CRM lifecycle transition and sends
 * pending events to Meta in batches (grouped by pixel).
 */
import {
  facebookConversionEvents,
  facebookLeads,
  facebookPages,
  facebookPixels,
  leads,
} from "@propninja/db";
import { and, desc, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import {
  type CapiEvent,
  type CapiSendResult,
  buildCapiUserData,
  buildCrmCapiCustomData,
  generateEventId,
  sendCapiEvents,
} from "../lib/metaCapi.js";
import { mapLeadStatusToCapiEvent } from "../lib/metaStatusMap.js";
import { decryptSecret } from "../lib/tokenEncryption.js";
import { getActiveAccessToken, getActiveSystemAccessToken } from "./metaTokenService.js";

/** Meta rejects Conversions API events older than 7 days. */
export const CAPI_MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Stop retrying a single event after this many non-auth Graph failures. */
const MAX_CAPI_EVENT_RETRIES = 5;

export const CAPI_PAGE_TOKEN_ERROR =
  "This Page access token belongs to a Page that is not accessible.";

export const CAPI_NO_TOKEN_ERROR = [
  "No usable Conversions API token.",
  `Page access tokens cannot send CAPI events (${CAPI_PAGE_TOKEN_ERROR}).`,
  "Use a system-user or Events Manager pixel token with ads_management, or set META_CAPI_ACCESS_TOKEN.",
].join(" ");

export const CAPI_STALE_EVENT_ERROR =
  "Meta only accepts Conversions API events from the last 7 days. This event is older and was not sent.";

export type SendPendingConversionResult = {
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
};

type ConversionEventRow = typeof facebookConversionEvents.$inferSelect;

/** Page tokens are rejected by `/{pixel-id}/events` with this Graph message. */
export function isMetaPageTokenError(error?: string, code?: number): boolean {
  const text = error ?? "";
  if (text.includes("Page access token belongs to a Page that is not accessible")) return true;
  return code === 190 && /page access token/i.test(text);
}

/** Token/permission failures. These must not permanently fail the event batch. */
export function isMetaAuthError(result: {
  error?: string;
  status?: number;
  code?: number;
}): boolean {
  if (isMetaPageTokenError(result.error, result.code)) return true;
  if (result.status === 401 || result.status === 403) return true;
  if (result.code === 190 || result.code === 102) return true;
  const text = result.error?.toLowerCase() ?? "";
  return (
    text.includes("error validating access token") ||
    text.includes("invalid oauth") ||
    text.includes("session has been invalidated") ||
    text.includes("(#200)") ||
    text.includes("permission")
  );
}

export function isStaleCapiEventTime(
  eventTime: Date | string | number | null | undefined,
  now = Date.now(),
): boolean {
  if (eventTime == null) return true;
  const instant = eventTime instanceof Date ? eventTime.getTime() : new Date(eventTime).getTime();
  if (Number.isNaN(instant)) return true;
  return now - instant > CAPI_MAX_EVENT_AGE_MS;
}

/**
 * Ordered CAPI tokens: dedicated env token, pixel token, system-user token, user token.
 * Any value that matches a stored Page access token is dropped — Meta rejects those
 * on the Conversions API with "This Page access token belongs to a Page that is not accessible."
 */
export function capiAccessTokenCandidates(
  tokens: {
    envToken?: string | null;
    pixelToken?: string | null;
    systemToken?: string | null;
    userToken?: string | null;
  },
  pageTokens: Iterable<string>,
): string[] {
  const blocked = new Set(pageTokens);
  const ordered = [tokens.envToken, tokens.pixelToken, tokens.systemToken, tokens.userToken];
  const out: string[] = [];
  for (const candidate of ordered) {
    const token = candidate?.trim();
    if (!token || blocked.has(token) || out.includes(token)) continue;
    out.push(token);
  }
  return out;
}

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

async function ensurePreferredPixel(orgId: string) {
  const preferredPixelId = process.env.META_CAPI_PIXEL_ID?.trim();
  if (!preferredPixelId) return null;

  const existing = await db
    .select()
    .from(facebookPixels)
    .where(and(eq(facebookPixels.orgId, orgId), eq(facebookPixels.pixelId, preferredPixelId)))
    .limit(1);

  if (existing[0]) {
    if (!existing[0].isActive || !existing[0].isSelected || !existing[0].isDefault) {
      await db
        .update(facebookPixels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(facebookPixels.orgId, orgId));
      const [updated] = await db
        .update(facebookPixels)
        .set({
          isActive: true,
          isSelected: true,
          isDefault: true,
          updatedAt: new Date(),
        })
        .where(and(eq(facebookPixels.orgId, orgId), eq(facebookPixels.pixelId, preferredPixelId)))
        .returning();
      return updated ?? existing[0];
    }
    return existing[0];
  }

  await db
    .update(facebookPixels)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(facebookPixels.orgId, orgId));

  const [created] = await db
    .insert(facebookPixels)
    .values({
      orgId,
      pixelId: preferredPixelId,
      name: process.env.META_CAPI_PIXEL_NAME?.trim() || "ninja",
      isActive: true,
      isSelected: true,
      isDefault: true,
    })
    .onConflictDoUpdate({
      target: [facebookPixels.orgId, facebookPixels.pixelId],
      set: {
        isActive: true,
        isSelected: true,
        isDefault: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  return created ?? null;
}

async function resolveDefaultPixel(orgId: string) {
  const preferred = await ensurePreferredPixel(orgId);
  if (preferred) return preferred;

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
    // Fall back to any active pixel if none marked selected (common after first sync).
    const [fallback] = await db
      .select()
      .from(facebookPixels)
      .where(and(eq(facebookPixels.orgId, orgId), eq(facebookPixels.isActive, true)))
      .orderBy(desc(facebookPixels.isDefault), desc(facebookPixels.updatedAt))
      .limit(1);
    if (!fallback) {
      logger.warn("Meta CAPI event skipped — no active pixel configured", { orgId, leadId });
      return { sent: false, skipped: true, reason: "no_pixel" };
    }
    return enqueueWithPixel(leadId, status, orgId, lead, eventName, fallback);
  }

  return enqueueWithPixel(leadId, status, orgId, lead, eventName, pixel);
}

async function enqueueWithPixel(
  leadId: string,
  _status: string,
  orgId: string,
  lead: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string;
    lastName: string;
    city: string | null;
    state: string | null;
    country: string | null;
  },
  eventName: string,
  pixel: typeof facebookPixels.$inferSelect,
): Promise<EnqueueConversionResult> {
  const [metaLead] = await db
    .select({
      leadgenId: facebookLeads.leadgenId,
      fbc: facebookLeads.fbc,
      fbp: facebookLeads.fbp,
      fbclid: facebookLeads.fbclid,
    })
    .from(facebookLeads)
    .where(and(eq(facebookLeads.orgId, orgId), eq(facebookLeads.leadId, lead.id)))
    .orderBy(desc(facebookLeads.ingestedAt))
    .limit(1);

  const fbc =
    metaLead?.fbc?.trim() ||
    (metaLead?.fbclid?.trim() ? `fb.1.${Date.now()}.${metaLead.fbclid.trim()}` : null);

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
    metaLeadId: metaLead?.leadgenId,
    fbc,
    fbp: metaLead?.fbp,
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
        customData: buildCrmCapiCustomData({ leadId: lead.id, leadStatus: _status }),
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

function eventInstant(value: Date | string | number | null | undefined): number {
  if (value == null) return Number.NaN;
  const instant = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return instant;
}

function toCapiEventPayload(row: ConversionEventRow): CapiEvent {
  const instant = eventInstant(row.eventTime);
  return {
    event_name: row.eventName,
    event_time: Math.floor(instant / 1000),
    event_id: row.eventId,
    action_source: (row.actionSource as CapiEvent["action_source"]) ?? "system_generated",
    event_source_url: row.eventSourceUrl ?? undefined,
    user_data: (row.userData ?? {}) as CapiEvent["user_data"],
    custom_data: row.customData ?? undefined,
  };
}

function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const token = decryptSecret(value).trim();
    return token || null;
  } catch (error) {
    logger.warn("Failed to decrypt Meta token for CAPI", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function loadPageAccessTokens(orgId: string): Promise<Set<string>> {
  const rows = await db
    .select({ accessTokenEncrypted: facebookPages.accessTokenEncrypted })
    .from(facebookPages)
    .where(and(eq(facebookPages.orgId, orgId), isNotNull(facebookPages.accessTokenEncrypted)));

  const tokens = new Set<string>();
  for (const row of rows) {
    const token = safeDecrypt(row.accessTokenEncrypted);
    if (token) tokens.add(token);
  }
  return tokens;
}

async function loadPixelAccessToken(orgId: string, pixelId: string): Promise<string | null> {
  const [pixel] = await db
    .select({ accessTokenEncrypted: facebookPixels.accessTokenEncrypted })
    .from(facebookPixels)
    .where(and(eq(facebookPixels.orgId, orgId), eq(facebookPixels.pixelId, pixelId)))
    .limit(1);
  return safeDecrypt(pixel?.accessTokenEncrypted);
}

function isTestEventCodeError(result: CapiSendResult): boolean {
  const text = result.error?.toLowerCase() ?? "";
  return text.includes("test_event_code") || text.includes("test event code");
}

async function markSent(rows: ConversionEventRow[], result: CapiSendResult) {
  if (rows.length === 0) return;
  await db
    .update(facebookConversionEvents)
    .set({
      status: "sent",
      httpStatus: result.status,
      responsePayload: { eventsReceived: result.eventsReceived, fbtraceId: result.fbtraceId },
      errorMessage: null,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      inArray(
        facebookConversionEvents.id,
        rows.map((row) => row.id),
      ),
    );
}

async function markFailed(rows: ConversionEventRow[], errorMessage: string, httpStatus?: number) {
  if (rows.length === 0) return;
  await db
    .update(facebookConversionEvents)
    .set({
      status: "failed",
      httpStatus: httpStatus ?? null,
      errorMessage,
      retryCount: sql`${facebookConversionEvents.retryCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      inArray(
        facebookConversionEvents.id,
        rows.map((row) => row.id),
      ),
    );
}

async function markSkipped(ids: string[], errorMessage: string) {
  if (ids.length === 0) return;
  await db
    .update(facebookConversionEvents)
    .set({
      status: "skipped",
      errorMessage,
      updatedAt: new Date(),
    })
    .where(inArray(facebookConversionEvents.id, ids));
}

async function requeuePending(rows: ConversionEventRow[], errorMessage: string) {
  if (rows.length === 0) return;
  await db
    .update(facebookConversionEvents)
    .set({
      status: "pending",
      errorMessage,
      updatedAt: new Date(),
    })
    .where(
      inArray(
        facebookConversionEvents.id,
        rows.map((row) => row.id),
      ),
    );
}

type Delivery = {
  sent: number;
  failed: number;
  error?: string;
  authError?: string;
  unsent: ConversionEventRow[];
};

async function deliverRows(
  pixelId: string,
  accessToken: string,
  rows: ConversionEventRow[],
  testEventCode: string | undefined,
): Promise<Delivery> {
  if (rows.length === 0) return { sent: 0, failed: 0, unsent: [] };

  let payloads: CapiEvent[];
  try {
    payloads = rows.map(toCapiEventPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (rows.length === 1) {
      await markFailed(rows, message);
      return { sent: 0, failed: 1, error: message, unsent: [] };
    }
    const mid = Math.floor(rows.length / 2);
    const left = await deliverRows(pixelId, accessToken, rows.slice(0, mid), testEventCode);
    if (left.authError) {
      return { ...left, unsent: [...left.unsent, ...rows.slice(mid)] };
    }
    const right = await deliverRows(pixelId, accessToken, rows.slice(mid), testEventCode);
    return mergeDelivery(left, right);
  }

  const result = await sendCapiEvents(pixelId, accessToken, payloads, { testEventCode });
  if (result.ok) {
    await markSent(rows, result);
    return { sent: rows.length, failed: 0, unsent: [] };
  }

  if (testEventCode && isTestEventCodeError(result)) {
    logger.warn("Meta CAPI test_event_code rejected; retrying without it", { pixelId });
    return deliverRows(pixelId, accessToken, rows, undefined);
  }

  if (isMetaAuthError(result)) {
    return {
      sent: 0,
      failed: 0,
      authError: result.error || CAPI_PAGE_TOKEN_ERROR,
      unsent: rows,
    };
  }

  if (rows.length > 1) {
    const mid = Math.floor(rows.length / 2);
    const left = await deliverRows(pixelId, accessToken, rows.slice(0, mid), testEventCode);
    if (left.authError) {
      return { ...left, unsent: [...left.unsent, ...rows.slice(mid)] };
    }
    const right = await deliverRows(pixelId, accessToken, rows.slice(mid), testEventCode);
    return mergeDelivery(left, right);
  }

  const message = result.error || "Meta CAPI send failed";
  await markFailed(rows, message, result.status);
  logger.error("Meta CAPI send failed", { pixelId, error: message, eventId: rows[0]?.eventId });
  return { sent: 0, failed: 1, error: message, unsent: [] };
}

function mergeDelivery(left: Delivery, right: Delivery): Delivery {
  return {
    sent: left.sent + right.sent,
    failed: left.failed + right.failed,
    error: left.error ?? right.error,
    authError: right.authError,
    unsent: [...left.unsent, ...right.unsent],
  };
}

/**
 * Sends up to `limit` conversion events to Meta, grouped by pixel.
 * Retries recent `failed` rows (the flush button and the 2-minute job both
 * call this) and never uses a Page access token for `/{pixel-id}/events`.
 */
export async function sendPendingConversionEvents(
  options: { orgId?: string; limit?: number } = {},
): Promise<SendPendingConversionResult> {
  const orgId = options.orgId ?? SINGLE_TENANT_ORG_ID;
  const limit = options.limit ?? 50;
  const cutoff = new Date(Date.now() - CAPI_MAX_EVENT_AGE_MS);
  const retryableStatus = or(
    eq(facebookConversionEvents.status, "pending"),
    and(
      eq(facebookConversionEvents.status, "failed"),
      lt(facebookConversionEvents.retryCount, MAX_CAPI_EVENT_RETRIES),
    ),
  );

  const skippedStale = await db
    .update(facebookConversionEvents)
    .set({
      status: "skipped",
      errorMessage: CAPI_STALE_EVENT_ERROR,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(facebookConversionEvents.orgId, orgId),
        or(
          eq(facebookConversionEvents.status, "pending"),
          eq(facebookConversionEvents.status, "failed"),
        ),
        lt(facebookConversionEvents.eventTime, cutoff),
      ),
    )
    .returning({ id: facebookConversionEvents.id });

  const pending = await db
    .select()
    .from(facebookConversionEvents)
    .where(
      and(
        eq(facebookConversionEvents.orgId, orgId),
        retryableStatus,
        gte(facebookConversionEvents.eventTime, cutoff),
      ),
    )
    .orderBy(facebookConversionEvents.createdAt)
    .limit(limit);

  let skipped = skippedStale.length;

  if (pending.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped,
      ...(skipped > 0 ? { error: CAPI_STALE_EVENT_ERROR } : {}),
    };
  }

  const fresh: ConversionEventRow[] = [];
  const staleIds: string[] = [];
  for (const row of pending) {
    if (isStaleCapiEventTime(row.eventTime)) staleIds.push(row.id);
    else fresh.push(row);
  }
  await markSkipped(staleIds, CAPI_STALE_EVENT_ERROR);
  skipped += staleIds.length;

  const byPixel = new Map<string, ConversionEventRow[]>();
  for (const row of fresh) {
    byPixel.set(row.pixelId, [...(byPixel.get(row.pixelId) ?? []), row]);
  }

  const pageTokens = await loadPageAccessTokens(orgId);
  const systemToken = await getActiveSystemAccessToken(orgId).catch((error) => {
    logger.warn("Failed to load Meta system-user token for CAPI", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  const userToken = await getActiveAccessToken(orgId).catch((error) => {
    logger.warn("Failed to load Meta user token for CAPI", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  const envToken = process.env.META_CAPI_ACCESS_TOKEN?.trim() || null;
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined;

  let sent = 0;
  let failed = 0;
  let error: string | undefined;

  for (const [pixelId, rows] of byPixel.entries()) {
    const pixelToken = await loadPixelAccessToken(orgId, pixelId);
    const tokens = capiAccessTokenCandidates(
      { envToken, pixelToken, systemToken, userToken },
      pageTokens,
    );
    let remaining = rows;

    if (tokens.length === 0) {
      error = error ?? CAPI_NO_TOKEN_ERROR;
      await requeuePending(remaining, CAPI_NO_TOKEN_ERROR);
      continue;
    }

    let authError: string | undefined;
    for (const accessToken of tokens) {
      const outcome = await deliverRows(pixelId, accessToken, remaining, testEventCode);
      sent += outcome.sent;
      failed += outcome.failed;
      if (outcome.error) error = error ?? outcome.error;
      remaining = outcome.unsent;
      if (outcome.authError && remaining.length > 0) {
        authError = outcome.authError;
        continue;
      }
      authError = outcome.authError;
      break;
    }

    if (authError && remaining.length > 0) {
      error = authError;
      await requeuePending(remaining, authError);
      logger.error("Meta CAPI send rejected the access token", { pixelId, error: authError });
    }
  }

  if (!error && skipped > 0 && sent === 0 && failed === 0) {
    error = CAPI_STALE_EVENT_ERROR;
  }

  return {
    sent,
    failed,
    skipped,
    ...(error ? { error } : {}),
  };
}
