import { agentDevices, trackingAlerts, users } from "@propninja/db";
import {
  type TrackingAlertSeverity,
  type TrackingAlertType,
  type TrackingHealthStatus,
  alertSeverityForStatus,
  deriveAgentAvailabilityStatus,
  deriveTrackingHealthStatus,
} from "@propninja/types/tracking";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import type { TrackingRuntimeConfig } from "../lib/trackingConfig.js";
import { isTrackingCaptureAllowed } from "../lib/trackingConfig.js";
import { createNotificationService } from "./notificationService.js";

const STATUS_TO_ALERT: Partial<Record<TrackingHealthStatus, TrackingAlertType>> = {
  LOCATION_PERMISSION_DENIED: "LOCATION_PERMISSION_REVOKED",
  LOCATION_PERMISSION_REVOKED: "LOCATION_PERMISSION_REVOKED",
  CALL_LOG_PERMISSION_DENIED: "CALL_LOG_PERMISSION_REVOKED",
  OFFLINE: "DEVICE_OFFLINE",
  STALE: "MISSING_LOCATION",
  APP_NOT_COMMUNICATING: "MISSING_LOCATION",
  POSSIBLE_APP_UNINSTALLED: "POSSIBLE_APP_REMOVAL",
  TRACKING_DISABLED: "TRACKING_STOPPED",
  DEVICE_CHANGED: "DEVICE_CHANGED",
};

function titleFor(type: TrackingAlertType): string {
  switch (type) {
    case "LOCATION_PERMISSION_REVOKED":
      return "Location permission revoked";
    case "CALL_LOG_PERMISSION_REVOKED":
      return "Call-log permission revoked";
    case "DEVICE_OFFLINE":
      return "Device offline";
    case "MISSING_LOCATION":
      return "Missing location updates";
    case "POSSIBLE_APP_REMOVAL":
      return "Possible app removal / device offline";
    case "TRACKING_STOPPED":
      return "Tracking stopped";
    case "DEVICE_CHANGED":
      return "Device changed";
    case "CLEANUP_JOB_FAILURE":
      return "Tracking cleanup failed";
    default:
      return "Tracking alert";
  }
}

export async function upsertOpenTrackingAlert(
  db: Database,
  input: {
    orgId: string;
    agentId: string;
    deviceId?: string | null;
    alertType: TrackingAlertType;
    severity: TrackingAlertSeverity;
    message: string;
    metadata?: Record<string, unknown>;
    notifyAdmins?: boolean;
  },
): Promise<{ id: string; created: boolean }> {
  const [existing] = await db
    .select({ id: trackingAlerts.id })
    .from(trackingAlerts)
    .where(
      and(
        eq(trackingAlerts.agentId, input.agentId),
        eq(trackingAlerts.alertType, input.alertType),
        eq(trackingAlerts.isResolved, false),
      ),
    )
    .limit(1);

  if (existing) {
    return { id: existing.id, created: false };
  }

  const [row] = await db
    .insert(trackingAlerts)
    .values({
      orgId: input.orgId,
      agentId: input.agentId,
      deviceId: input.deviceId ?? null,
      alertType: input.alertType,
      severity: input.severity,
      title: titleFor(input.alertType),
      message: input.message,
      metadata: input.metadata ?? {},
      notifiedAt: input.notifyAdmins === false ? null : new Date(),
    })
    .returning({ id: trackingAlerts.id });

  if (input.notifyAdmins !== false) {
    void notifyAdminsOfTrackingAlert(db, {
      orgId: input.orgId,
      agentId: input.agentId,
      title: titleFor(input.alertType),
      message: input.message,
      severity: input.severity,
      alertType: input.alertType,
    }).catch((err) => {
      logger.warn("Failed to notify admins of tracking alert", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return { id: row!.id, created: true };
}

export async function resolveTrackingAlertsOfTypes(
  db: Database,
  agentId: string,
  alertTypes: TrackingAlertType[],
): Promise<void> {
  for (const alertType of alertTypes) {
    await db
      .update(trackingAlerts)
      .set({ isResolved: true, resolvedAt: new Date() })
      .where(
        and(
          eq(trackingAlerts.agentId, agentId),
          eq(trackingAlerts.alertType, alertType),
          eq(trackingAlerts.isResolved, false),
        ),
      );
  }
}

async function notifyAdminsOfTrackingAlert(
  db: Database,
  input: {
    orgId: string;
    agentId: string;
    title: string;
    message: string;
    severity: TrackingAlertSeverity;
    alertType: TrackingAlertType;
  },
) {
  const admins = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.orgId, input.orgId), eq(users.role, "admin"), eq(users.isActive, true)));

  const [agent] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, input.agentId))
    .limit(1);

  const notifications = createNotificationService(db);
  for (const admin of admins) {
    await notifications.createNotification(
      admin.id,
      "tracking_alert",
      {
        agentId: input.agentId,
        agentName: agent?.name ?? "Agent",
        title: input.title,
        message: input.message,
        severity: input.severity,
        alertType: input.alertType,
      },
      { push: input.severity !== "INFO" },
    );
  }
}

export async function evaluateDeviceHealthAndAlert(
  db: Database,
  device: typeof agentDevices.$inferSelect,
  policyEnabled: boolean,
  config: TrackingRuntimeConfig,
  orgId: string,
): Promise<TrackingHealthStatus> {
  const withinHours = isTrackingCaptureAllowed(new Date(), config);
  const status = deriveTrackingHealthStatus({
    trackingPolicyEnabled: policyEnabled,
    trackingEnabledGlobal: config.enabled,
    clientTrackingEnabled: device.trackingEnabled,
    locationPermissionStatus: device.locationPermissionStatus,
    callLogPermissionStatus: device.callLogPermissionStatus,
    lastSeenAt: device.lastSeenAt,
    lastLocationAt: device.lastLocationAt,
    lastHeartbeatAt: device.lastHeartbeatAt,
    isCurrentDevice: device.isCurrent,
    withinHours,
    heartbeatThresholdMinutes: config.heartbeatThresholdMinutes,
    missingAlertMinutes: config.missingAlertMinutes,
    possibleUninstallMinutes: config.possibleUninstallMinutes,
  });

  const agentStatus = deriveAgentAvailabilityStatus({
    trackingPolicyEnabled: policyEnabled,
    trackingEnabledGlobal: config.enabled,
    clientTrackingEnabled: device.trackingEnabled,
    lastLocationAt: device.lastLocationAt,
    missingAlertMinutes: config.missingAlertMinutes,
  });

  await db
    .update(agentDevices)
    .set({
      healthStatus: status,
      agentStatus,
      deviceStatus:
        status === "ACTIVE" || status === "OUTSIDE_HOURS"
          ? "ONLINE"
          : status === "TRACKING_DISABLED"
            ? "DISABLED"
            : status === "STALE"
              ? "ONLINE"
              : "OFFLINE",
      updatedAt: new Date(),
    })
    .where(eq(agentDevices.id, device.id));

  const alertType = STATUS_TO_ALERT[status];
  if (alertType && status !== "OUTSIDE_HOURS" && status !== "ACTIVE") {
    const lastSeen = device.lastSeenAt?.toISOString() ?? null;
    const lastLoc = device.lastLocationAt?.toISOString() ?? null;
    await upsertOpenTrackingAlert(db, {
      orgId,
      agentId: device.userId,
      deviceId: device.deviceId,
      alertType,
      severity: alertSeverityForStatus(status),
      message: `Status ${status}. Last seen ${lastSeen ?? "never"}; last location ${lastLoc ?? "never"}.`,
      metadata: { healthStatus: status, agentStatus, lastSeen, lastLoc },
    });
  } else if (status === "ACTIVE" || status === "OUTSIDE_HOURS") {
    await resolveTrackingAlertsOfTypes(db, device.userId, [
      "DEVICE_OFFLINE",
      "MISSING_LOCATION",
      "POSSIBLE_APP_REMOVAL",
      "LOCATION_PERMISSION_REVOKED",
      "CALL_LOG_PERMISSION_REVOKED",
      "TRACKING_STOPPED",
    ]);
  }

  return status;
}

export async function listOpenTrackingAlerts(db: Database, orgId: string, limit = 100) {
  return db
    .select({
      id: trackingAlerts.id,
      agentId: trackingAlerts.agentId,
      deviceId: trackingAlerts.deviceId,
      alertType: trackingAlerts.alertType,
      severity: trackingAlerts.severity,
      title: trackingAlerts.title,
      message: trackingAlerts.message,
      metadata: trackingAlerts.metadata,
      createdAt: trackingAlerts.createdAt,
      agentName: users.name,
      agentEmail: users.email,
    })
    .from(trackingAlerts)
    .innerJoin(users, eq(trackingAlerts.agentId, users.id))
    .where(and(eq(trackingAlerts.orgId, orgId), eq(trackingAlerts.isResolved, false)))
    .orderBy(desc(trackingAlerts.createdAt))
    .limit(limit);
}
