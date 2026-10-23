/**
 * Re-fetches Meta leads that were delivered or listed but never landed in the
 * CRM. Each attempt calls Graph for that lead id, so a miss does not depend
 * on the form still being inside the list window.
 */
import { facebookLeads, facebookWebhooks } from "@propninja/db";
import { and, asc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { normalizeMetaLeadgenChange } from "../lib/facebook.js";
import { logger } from "../lib/logger.js";
import {
  META_FAILED_LEAD_FAST_ATTEMPTS,
  META_FAILED_LEAD_MAX_AGE_MS,
  META_FAILED_LEAD_MAX_ATTEMPTS,
  META_STUCK_LEAD_MS,
  isMetaLeadRetryDue,
} from "../lib/metaFailedLeadRetry.js";
import { processLeadgenWebhook } from "./metaLeadIngestService.js";

export type FailedMetaLeadRetryResult = {
  checked: number;
  recovered: number;
  stillFailed: number;
  alreadyIngested: number;
};

let retryInFlight = false;

export async function retryFailedMetaLeads(
  orgId: string = SINGLE_TENANT_ORG_ID,
  options: { thorough?: boolean } = {},
): Promise<FailedMetaLeadRetryResult> {
  const result: FailedMetaLeadRetryResult = {
    checked: 0,
    recovered: 0,
    stillFailed: 0,
    alreadyIngested: 0,
  };

  if (retryInFlight) return result;
  retryInFlight = true;

  const thorough = options.thorough === true;
  const now = Date.now();
  const oldest = new Date(now - META_FAILED_LEAD_MAX_AGE_MS);
  const stuckBefore = new Date(now - META_STUCK_LEAD_MS);

  try {
    const rows = await db
      .select({
        id: facebookWebhooks.id,
        status: facebookWebhooks.status,
        retryCount: facebookWebhooks.retryCount,
        createdAt: facebookWebhooks.createdAt,
        payload: facebookWebhooks.payload,
      })
      .from(facebookWebhooks)
      .where(
        and(
          eq(facebookWebhooks.orgId, orgId),
          eq(facebookWebhooks.eventType, "leadgen"),
          gte(facebookWebhooks.createdAt, oldest),
          lt(facebookWebhooks.retryCount, META_FAILED_LEAD_MAX_ATTEMPTS),
          or(
            and(
              eq(facebookWebhooks.status, "failed"),
              ...(thorough
                ? []
                : [lt(facebookWebhooks.retryCount, META_FAILED_LEAD_FAST_ATTEMPTS)]),
            ),
            and(
              inArray(facebookWebhooks.status, ["queued", "processing", "received"]),
              lt(facebookWebhooks.createdAt, stuckBefore),
            ),
          ),
        ),
      )
      .orderBy(asc(facebookWebhooks.retryCount), asc(facebookWebhooks.createdAt))
      .limit(thorough ? 100 : 40);

    for (const row of rows) {
      if (!isMetaLeadRetryDue(row, now, thorough)) continue;
      result.checked += 1;

      const change = normalizeMetaLeadgenChange(
        row.payload as Parameters<typeof normalizeMetaLeadgenChange>[0],
      );
      if (!change) {
        await db
          .update(facebookWebhooks)
          .set({ status: "skipped", errorMessage: "Missing leadgen id; cannot re-pull" })
          .where(eq(facebookWebhooks.id, row.id));
        result.stillFailed += 1;
        continue;
      }

      const [mirror] = await db
        .select({ id: facebookLeads.id })
        .from(facebookLeads)
        .where(and(eq(facebookLeads.orgId, orgId), eq(facebookLeads.leadgenId, change.leadgen_id)))
        .limit(1);

      if (mirror) {
        await db
          .update(facebookWebhooks)
          .set({ status: "processed", processedAt: new Date(), errorMessage: null })
          .where(eq(facebookWebhooks.id, row.id));
        result.alreadyIngested += 1;
        continue;
      }

      try {
        await processLeadgenWebhook(change, {
          orgId,
          webhookId: row.id,
          via: "reconciliation",
        });
        result.recovered += 1;
        logger.info("Re-pulled a failed Meta lead", { leadgenId: change.leadgen_id });
      } catch (error) {
        result.stillFailed += 1;
        logger.warn("Re-pull of a failed Meta lead did not land", {
          leadgenId: change.leadgen_id,
          attempt: row.retryCount + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (result.checked > 0) {
      logger.info("Finished Meta failed-lead re-pull", result);
    }
  } catch (error) {
    logger.warn("Meta failed-lead re-pull failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    retryInFlight = false;
  }

  return result;
}
