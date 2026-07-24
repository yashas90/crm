/**
 * Webhook / queue health for Meta Lead Ads (Healthy / Delayed / Offline).
 */
import { facebookSyncHistory, facebookTokens, facebookWebhooks } from "@propninja/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { isDurableJobsEnabled } from "../lib/jobQueue.js";

export type MetaWebhookHealthStatus = "healthy" | "delayed" | "offline";

export type MetaWebhookHealth = {
  status: MetaWebhookHealthStatus;
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

const HEALTHY_MAX_AGE_MS = 15 * 60 * 1000;
const DELAYED_MAX_AGE_MS = 60 * 60 * 1000;

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
        .select({ finishedAt: facebookSyncHistory.finishedAt })
        .from(facebookSyncHistory)
        .where(
          and(
            eq(facebookSyncHistory.orgId, orgId),
            eq(facebookSyncHistory.syncType, "leads_backfill"),
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
            eq(facebookSyncHistory.syncType, "leads_backfill"),
            gte(facebookSyncHistory.startedAt, since24h),
          ),
        ),
    ]);

  const lastSuccessAt = lastOk?.processedAt?.toISOString() ?? null;
  const lastReceivedAt = lastAny?.createdAt?.toISOString() ?? null;
  const lastFailureAt = lastFail?.createdAt?.toISOString() ?? null;
  const successAgeMs = lastOk?.processedAt ? Date.now() - lastOk.processedAt.getTime() : null;
  const receivedAgeMs = lastAny?.createdAt ? Date.now() - lastAny.createdAt.getTime() : null;

  let status: MetaWebhookHealthStatus = "offline";
  let label = "Offline — no webhook activity yet. Use Pull leads / wait for Meta delivery.";

  if (successAgeMs !== null && successAgeMs <= HEALTHY_MAX_AGE_MS) {
    status = "healthy";
    label = "Healthy — webhooks processing in real time";
  } else if (
    (successAgeMs !== null && successAgeMs <= DELAYED_MAX_AGE_MS) ||
    (receivedAgeMs !== null && receivedAgeMs <= DELAYED_MAX_AGE_MS) ||
    (counts15?.received ?? 0) > 0
  ) {
    status = "delayed";
    label = "Delayed — reconciliation will catch missed leads every 5 minutes";
  } else if (lastSuccessAt || lastReceivedAt) {
    status = "offline";
    label = "Offline — no recent webhooks; 5‑minute reconciliation is the safety net";
  }

  const durableJobsEnabled = isDurableJobsEnabled();
  if (!durableJobsEnabled && status === "healthy") {
    label = "Healthy (in-process fallback — set REDIS_URL for durable queues)";
  }

  const tokenExpiresAt = token?.expiresAt?.toISOString() ?? null;
  const tokenExpiringSoon = Boolean(
    token?.expiresAt && token.expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000,
  );

  return {
    status,
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
    lastReconciliationAt: lastRecon?.finishedAt?.toISOString() ?? null,
    nextReconciliationHint: "Every 5 minutes (backup only)",
    tokenExpiresAt,
    tokenExpiringSoon,
  };
}
