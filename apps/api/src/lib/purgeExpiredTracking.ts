import { randomUUID } from "node:crypto";
import { agentCallLogs, agentLocations, trackingCleanupRuns } from "@propninja/db";
import { users } from "@propninja/db";
import { lt } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { upsertOpenTrackingAlert } from "../services/trackingAlertService.js";
import type { Database } from "./db.js";
import { db as defaultDb } from "./db.js";
import { logger } from "./logger.js";
import { getTrackingConfig } from "./trackingConfig.js";

export type TrackingRetentionResult = {
  locationsDeleted: number;
  callLogsDeleted: number;
  retentionDays: number;
  cleanupRunId: string;
  status: "completed" | "failed";
};

export async function purgeExpiredTrackingData(
  database: Database = defaultDb,
): Promise<TrackingRetentionResult> {
  const { retentionDays } = getTrackingConfig();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const jobId = `tracking-retention-cleanup:${randomUUID()}`;
  const startedAt = new Date();

  const [run] = await database
    .insert(trackingCleanupRuns)
    .values({
      jobId,
      startedAt,
      status: "running",
    })
    .returning({ id: trackingCleanupRuns.id });

  const cleanupRunId = run?.id ?? jobId;

  try {
    const locationResult = await database
      .delete(agentLocations)
      .where(lt(agentLocations.capturedAt, cutoff))
      .returning({ id: agentLocations.id });

    const callResult = await database
      .delete(agentCallLogs)
      .where(lt(agentCallLogs.callStartTime, cutoff))
      .returning({ id: agentCallLogs.id });

    const result = {
      locationsDeleted: locationResult.length,
      callLogsDeleted: callResult.length,
      retentionDays,
      cleanupRunId,
      status: "completed" as const,
    };

    await database
      .update(trackingCleanupRuns)
      .set({
        completedAt: new Date(),
        locationRecordsDeleted: result.locationsDeleted,
        callLogRecordsDeleted: result.callLogsDeleted,
        temporaryRecordsDeleted: 0,
        status: "completed",
      })
      .where(eq(trackingCleanupRuns.id, cleanupRunId));

    logger.info("Tracking retention cleanup completed", {
      ...result,
      cutoff: cutoff.toISOString(),
      jobId,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await database
      .update(trackingCleanupRuns)
      .set({
        completedAt: new Date(),
        status: "failed",
        error: message.slice(0, 2000),
      })
      .where(eq(trackingCleanupRuns.id, cleanupRunId));

    logger.warn("Tracking retention cleanup failed", { jobId, err: message });

    // Notify admins once (best-effort) via first active admin's org.
    try {
      const [admin] = await database
        .select({ id: users.id, orgId: users.orgId })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
        .limit(1);
      if (admin) {
        await upsertOpenTrackingAlert(database, {
          orgId: admin.orgId,
          agentId: admin.id,
          alertType: "CLEANUP_JOB_FAILURE",
          severity: "CRITICAL",
          message: `Retention cleanup failed: ${message}`,
          metadata: { jobId },
        });
      }
    } catch {
      // ignore nested notify failures
    }

    throw err;
  }
}
