import { agentDevices, users } from "@propninja/db";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { getTrackingConfigForOrg } from "../lib/trackingConfig.js";
import { evaluateDeviceHealthAndAlert } from "../services/trackingAlertService.js";

const INTERVAL_MS = 15 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncTrackingHealthEvaluation() {
  const agents = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      trackingPolicyEnabled: users.trackingPolicyEnabled,
    })
    .from(users)
    .where(and(eq(users.role, "agent"), eq(users.isActive, true)));

  let evaluated = 0;
  for (const agent of agents) {
    const config = await getTrackingConfigForOrg(db, agent.orgId);
    const [device] = await db
      .select()
      .from(agentDevices)
      .where(and(eq(agentDevices.userId, agent.id), eq(agentDevices.isCurrent, true)))
      .orderBy(desc(agentDevices.lastSeenAt))
      .limit(1);
    if (!device) continue;
    await evaluateDeviceHealthAndAlert(
      db,
      device,
      agent.trackingPolicyEnabled,
      config,
      agent.orgId,
    );
    evaluated += 1;
  }

  logger.info("Tracking health evaluation completed", { agents: agents.length, evaluated });
  return { agents: agents.length, evaluated };
}

export function startTrackingHealthJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting tracking health evaluation scheduler", { intervalMs: INTERVAL_MS });
  void syncTrackingHealthEvaluation().catch((err) => {
    logger.warn("Tracking health evaluation failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  syncTimer = setInterval(() => {
    void syncTrackingHealthEvaluation().catch((err) => {
      logger.warn("Tracking health evaluation failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopTrackingHealthJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
