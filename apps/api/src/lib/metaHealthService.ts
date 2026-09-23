/**
 * Webhook / queue health for Meta Lead Ads (Healthy / Delayed / Offline).
 *
 * Meta only pushes a webhook when a lead is created, so a quiet hour is not an
 * outage. The always-on Graph pull is the other half of "healthy".
 */
import { facebookSyncHistory, facebookTokens, facebookWebhooks } from "@propninja/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { isDurableJobsEnabled } from "../lib/jobQueue.js";

export type MetaWebhookHealthStatus = "healthy" | "delayed" | "offline";
export type MetaLeadIntake = "webhook" | "polling" | "stale";

export type MetaWebhookHealth = {
  status: MetaWebhookHealthStatus;
  /** How leads are arriving right now. `polling` means the Graph pull is the live path. */
  intake: MetaLeadIntake;
  label: string;
  durableJobsEnabled: boolean;
  lastReceivedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  avgProcessingMs: number | null;
  receivedLast15m: number;
  processedLast15m: number;
  failedLast15m: number;
  queuedOrProcessing: number;
  recoveredLeadsLast24h: number;
  lastReconciliationAt: string | null;
  nextReconciliationHint: string;
  tokenExpiresAt: string | null;
  tokenExpiringSoon: boolean;
};

/** A processed webhook this fresh counts as real-time delivery. */
export const META_WEBHOOK_HEALTHY_MS = 15 * 60 * 1000;
/** Webhook deliveries older than this, with no fresh pull, are delayed rather than offline. */
export const META_WEBHOOK_DELAYED_MS = 60 * 60 * 1000;
/**
 * Continuous pull interval is 2 minutes. Allow a few missed ticks (deploys,
 * a long form scan) before the badge leaves Healthy.
 */
export const META_POLL_HEALTHY_MS = 8 * 60 * 1000;
export const META_POLL_DELAYED_MS = 30 * 60 * 1000;

const LEAD_PULL_SYNC_TYPES = ["leads_backfill", "leads_continuity"] as const;

export type MetaWebhookHealthSignals = {
  successAgeMs: number | null;
  receivedAgeMs: number | null;
  receivedLast15m: number;
  reconciliationAgeMs: number | null;
  /** A finished pull that actually scanned forms (or ingested leads). */
  reconciliationUseful: boolean;
  /** The latest pull finished as failed (Graph/token errors, nothing ingested). */
  reconciliationFailed: boolean;
  hasAnySignal: boolean;
};

export function classifyMetaWebhookHealth(input: MetaWebhookHealthSignals): {
  status: MetaWebhookHealthStatus;
  intake: MetaLeadIntake;
  label: string;
} {
  const webhookFresh = input.successAgeMs !== null && input.successAgeMs <= META_WEBHOOK_HEALTHY_MS;
  const webhookDelayed =
    (input.successAgeMs !== null && input.successAgeMs <= META_WEBHOOK_DELAYED_MS) ||
    (input.receivedAgeMs !== null && input.receivedAgeMs <= META_WEBHOOK_DELAYED_MS) ||
    input.receivedLast15m > 0;
  const pollFresh =
    input.reconciliationAgeMs !== null && input.reconciliationAgeMs <= META_POLL_HEALTHY_MS;
  const pollDelayed =
    input.reconciliationAgeMs !== null && input.reconciliationAgeMs <= META_POLL_DELAYED_MS;

  if (webhookFresh) {
    return {
      status: "healthy",
      intake: "webhook",
      label: "Healthy — webhooks processing in real time",
    };
  }

  if (pollFresh && input.reconciliationUseful) {
    return {
      status: "healthy",
      intake: "polling",
      label: "Healthy — continuous Graph pull is grabbing Meta leads",
    };
  }

  if ((pollFresh || pollDelayed) && input.reconciliationFailed) {
    return {
      status: "delayed",
      intake: "polling",
      label: "Delayed — latest Meta lead pull failed; retrying automatically",
    };
  }

  if (webhookDelayed || (pollDelayed && input.reconciliationUseful)) {
    return {
      status: "delayed",
      intake: pollDelayed ? "polling" : "webhook",
      label:
        pollDelayed && !webhookDelayed
          ? "Delayed — Meta lead pull is behind schedule"
          : "Delayed — reconciliation will catch missed leads",
    };
  }

  if (input.hasAnySignal) {
    return {
      status: "offline",
      intake: "stale",
      label: "Offline — no recent webhooks or lead pulls",
    };
  }

  return {
    status: "offline",
    intake: "stale",
    label: "Offline — no webhook activity yet. Continuous pull starts after Meta is connected.",
  };
}

function formsScannedFrom(metadata: Record<string, unknown> | null | undefined): number {
  const value = metadata?.formsScanned;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getMetaWebhookHealth(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<MetaWebhookHealth> {
  const since15m = new Date(Date.now() - 15 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[lastAny], [lastOk], [lastFail], [counts15], [queued], [token], [lastRecon], [recovered]] =
    await Promise.all([
      db
        .select({ createdAt: facebookWebhooks.createdAt })
        .from(facebookWebhooks)
        .where(eq(facebookWebhooks.orgId, orgId))
        .orderBy(desc(facebookWebhooks.createdAt))
        .limit(1),
      db
        .select({ processedAt: facebookWebhooks.processedAt })
        .from(facebookWebhooks)
        .where(and(eq(facebookWebhooks.orgId, orgId), eq(facebookWebhooks.status, "processed")))
        .orderBy(desc(facebookWebhooks.processedAt))
        .limit(1),
      db
        .select({ createdAt: facebookWebhooks.createdAt })
        .from(facebookWebhooks)
        .where(and(eq(facebookWebhooks.orgId, orgId), eq(facebookWebhooks.status, "failed")))
        .orderBy(desc(facebookWebhooks.createdAt))
        .limit(1),
      db
        .select({
          received: sql<number>`count(*)::int`,
          processed: sql<number>`count(*) filter (where ${facebookWebhooks.status} = 'processed')::int`,
          failed: sql<number>`count(*) filter (where ${facebookWebhooks.status} = 'failed')::int`,
          avgMs: sql<
            number | null
          >`round(avg(extract(epoch from (${facebookWebhooks.processedAt} - ${facebookWebhooks.createdAt})) * 1000))::int`,
        })
        .from(facebookWebhooks)
        .where(and(eq(facebookWebhooks.orgId, orgId), gte(facebookWebhooks.createdAt, since15m))),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(facebookWebhooks)
        .where(
          and(
            eq(facebookWebhooks.orgId, orgId),
            sql`${facebookWebhooks.status} in ('queued', 'processing')`,
          ),
        ),
      db
        .select({ expiresAt: facebookTokens.expiresAt })
        .from(facebookTokens)
        .where(and(eq(facebookTokens.orgId, orgId), eq(facebookTokens.tokenType, "user")))
        .orderBy(desc(facebookTokens.updatedAt))
        .limit(1),
      db
        .select({
          finishedAt: facebookSyncHistory.finishedAt,
          status: facebookSyncHistory.status,
          metadata: facebookSyncHistory.metadata,
          recordsProcessed: facebookSyncHistory.recordsProcessed,
        })
        .from(facebookSyncHistory)
        .where(
          and(
            eq(facebookSyncHistory.orgId, orgId),
            inArray(facebookSyncHistory.syncType, [...LEAD_PULL_SYNC_TYPES]),
          ),
        )
        .orderBy(desc(facebookSyncHistory.finishedAt))
        .limit(1),
      db
        .select({
          value: sql<number>`coalesce(sum(${facebookSyncHistory.recordsProcessed}), 0)::int`,
        })
        .from(facebookSyncHistory)
        .where(
          and(
            eq(facebookSyncHistory.orgId, orgId),
            inArray(facebookSyncHistory.syncType, [...LEAD_PULL_SYNC_TYPES]),
            gte(facebookSyncHistory.startedAt, since24h),
          ),
        ),
    ]);

  const lastSuccessAt = lastOk?.processedAt?.toISOString() ?? null;
  const lastReceivedAt = lastAny?.createdAt?.toISOString() ?? null;
  const lastFailureAt = lastFail?.createdAt?.toISOString() ?? null;
  const lastReconciliationAt = lastRecon?.finishedAt?.toISOString() ?? null;
  const successAgeMs = lastOk?.processedAt ? Date.now() - lastOk.processedAt.getTime() : null;
  const receivedAgeMs = lastAny?.createdAt ? Date.now() - lastAny.createdAt.getTime() : null;
  const reconciliationAgeMs = lastRecon?.finishedAt
    ? Date.now() - lastRecon.finishedAt.getTime()
    : null;
  const formsScanned = formsScannedFrom(lastRecon?.metadata);
  const reconciliationUseful =
    (lastRecon?.status === "success" || lastRecon?.status === "partial") &&
    (formsScanned > 0 || (lastRecon?.recordsProcessed ?? 0) > 0);
  const reconciliationFailed = lastRecon?.status === "failed";

  const classified = classifyMetaWebhookHealth({
    successAgeMs,
    receivedAgeMs,
    receivedLast15m: counts15?.received ?? 0,
    reconciliationAgeMs,
    reconciliationUseful,
    reconciliationFailed,
    hasAnySignal: Boolean(lastSuccessAt || lastReceivedAt || lastReconciliationAt),
  });

  const durableJobsEnabled = isDurableJobsEnabled();
  let { label } = classified;
  if (!durableJobsEnabled && classified.status === "healthy" && classified.intake === "webhook") {
    label = "Healthy (in-process fallback — set REDIS_URL for durable queues)";
  }

  const tokenExpiresAt = token?.expiresAt?.toISOString() ?? null;
  const tokenExpiringSoon = Boolean(
    token?.expiresAt && token.expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000,
  );

  return {
    status: classified.status,
    intake: classified.intake,
    label,
    durableJobsEnabled,
    lastReceivedAt,
    lastSuccessAt,
    lastFailureAt,
    avgProcessingMs: counts15?.avgMs ?? null,
    receivedLast15m: counts15?.received ?? 0,
    processedLast15m: counts15?.processed ?? 0,
    failedLast15m: counts15?.failed ?? 0,
    queuedOrProcessing: queued?.value ?? 0,
    recoveredLeadsLast24h: recovered?.value ?? 0,
    lastReconciliationAt,
    nextReconciliationHint: "Every 2 minutes (continuous Graph pull)",
    tokenExpiresAt,
    tokenExpiringSoon,
  };
}
