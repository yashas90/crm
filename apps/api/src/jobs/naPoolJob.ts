import { leads } from "@propninja/db";
import { and, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { leadService } from "../services/leadService.js";

/** Grace period before NA-status leads are unassigned to the org NA pool. */
export const NA_POOL_RELEASE_DELAY_MS = 2 * 60 * 1000;

const NA_STATUSES = ["not_interested", "dropped"] as const;

const INTERVAL_MS = 30 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncNaPoolUnassignments() {
  const db = getDb();
  const cutoff = new Date(Date.now() - NA_POOL_RELEASE_DELAY_MS);

  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        isNotNull(leads.assignedTo),
        inArray(leads.leadStatus, [...NA_STATUSES]),
        lte(leads.updatedAt, cutoff),
      ),
    );

  let released = 0;
  for (const row of rows) {
    const ok = await leadService.releaseLeadToNaPool(row.id);
    if (ok) released += 1;
  }

  if (released > 0) {
    logger.info("Released leads to NA pool", { released, checked: rows.length });
  }

  return { released, checked: rows.length };
}

export function startNaPoolJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting NA pool release scheduler", {
    intervalMs: INTERVAL_MS,
    delayMs: NA_POOL_RELEASE_DELAY_MS,
  });

  void syncNaPoolUnassignments().catch((err) => {
    logger.warn("NA pool release failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });
  syncTimer = setInterval(() => {
    void syncNaPoolUnassignments().catch((err) => {
      logger.warn("NA pool release failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
}

export function stopNaPoolJob() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = undefined;
}
