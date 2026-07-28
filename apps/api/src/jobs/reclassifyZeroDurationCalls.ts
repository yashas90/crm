/**
 * One-shot data repair: zero-duration "answered" calls were often auto-logged
 * incorrectly. Reclassify them as no_answer so Profile analytics split correctly.
 */
import { callRecords } from "@propninja/db";
import { and, eq, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export async function reclassifyZeroDurationAnsweredCalls() {
  const updated = await db
    .update(callRecords)
    .set({
      outcome: "no_answer",
      disposition: "no_answer",
      status: "missed",
    })
    .where(
      and(
        eq(callRecords.orgId, SINGLE_TENANT_ORG_ID),
        or(eq(callRecords.outcome, "answered"), eq(callRecords.disposition, "answered")),
        sql`coalesce(${callRecords.durationSeconds}, 0) = 0`,
      ),
    )
    .returning({ id: callRecords.id });

  if (updated.length > 0) {
    logger.info("Reclassified zero-duration answered calls as no_answer", {
      count: updated.length,
    });
  }

  return { reclassified: updated.length };
}
