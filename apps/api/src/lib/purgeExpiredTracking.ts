import { agentCallLogs, agentLocations } from "@propninja/db";
import { lt, sql } from "drizzle-orm";
import type { Database } from "./db.js";
import { db as defaultDb } from "./db.js";
import { logger } from "./logger.js";
import { getTrackingConfig } from "./trackingConfig.js";

export type TrackingRetentionResult = {
  locationsDeleted: number;
  callLogsDeleted: number;
  retentionDays: number;
};

export async function purgeExpiredTrackingData(
  database: Database = defaultDb,
): Promise<TrackingRetentionResult> {
  const { retentionDays } = getTrackingConfig();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

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
  };

  logger.info("Tracking retention cleanup completed", {
    ...result,
    cutoff: cutoff.toISOString(),
  });

  return result;
}

/** Idempotent SQL form used by tests / ops. */
export async function purgeExpiredTrackingDataSql(
  database: Database = defaultDb,
): Promise<{ locationsDeleted: number; callLogsDeleted: number }> {
  const { retentionDays } = getTrackingConfig();
  const loc = await database.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM agent_locations
      WHERE captured_at < NOW() - (${retentionDays}::text || ' days')::interval
      RETURNING id
    )
    SELECT COUNT(*)::text AS count FROM deleted
  `);
  const calls = await database.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM agent_call_logs
      WHERE call_start_time < NOW() - (${retentionDays}::text || ' days')::interval
      RETURNING id
    )
    SELECT COUNT(*)::text AS count FROM deleted
  `);
  return {
    locationsDeleted: Number(loc[0]?.count ?? 0),
    callLogsDeleted: Number(calls[0]?.count ?? 0),
  };
}
