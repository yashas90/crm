import { agentDevices, users } from "@propninja/db";
import { and, eq, ne } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import type { TrackingRuntimeConfig } from "../lib/trackingConfig.js";
import { evaluateDeviceHealthAndAlert } from "../services/trackingAlertService.js";
import { upsertOpenTrackingAlert } from "../services/trackingAlertService.js";

export type DeviceUpsertInput = {
  deviceId: string;
  platform: string;
  appVersion?: string | null;
  installationId?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  osVersion?: string | null;
  locationPermissionStatus?: string | null;
  callLogPermissionStatus?: string | null;
  trackingEnabled?: boolean;
  batteryLevel?: number | null;
  networkStatus?: string | null;
  heartbeat?: boolean;
  lastCallLogSyncAt?: Date | null;
  lastBootAt?: Date | null;
  queuedOfflinePingCount?: number | null;
  permissionDeniedCount?: number | null;
  batteryOptimizationIgnored?: boolean | null;
  notifyPermissionDenied?: boolean;
};

export async function upsertAgentDevice(
  db: Database,
  userId: string,
  orgId: string,
  input: DeviceUpsertInput,
  config: TrackingRuntimeConfig,
): Promise<typeof agentDevices.$inferSelect> {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(agentDevices)
    .where(and(eq(agentDevices.userId, userId), eq(agentDevices.deviceId, input.deviceId)))
    .limit(1);

  const prevLocPerm = existing?.locationPermissionStatus ?? null;
  const prevCallPerm = existing?.callLogPermissionStatus ?? null;

  // Mark other devices for this user as replaced when a new current device checks in.
  await db
    .update(agentDevices)
    .set({
      isCurrent: false,
      replacedAt: now,
      healthStatus: "DEVICE_CHANGED",
      updatedAt: now,
    })
    .where(and(eq(agentDevices.userId, userId), ne(agentDevices.deviceId, input.deviceId)));

  const locStatus = (
    input.locationPermissionStatus ??
    existing?.locationPermissionStatus ??
    ""
  ).toLowerCase();
  const locationDenied =
    locStatus === "denied" || locStatus === "restricted" || locStatus.includes("revok");
  const deniedCount = locationDenied
    ? (input.permissionDeniedCount ?? existing?.permissionDeniedCount ?? 0)
    : 0;

  const values = {
    userId,
    deviceId: input.deviceId,
    platform: input.platform,
    appVersion: input.appVersion ?? existing?.appVersion ?? null,
    installationId: input.installationId ?? existing?.installationId ?? null,
    manufacturer: input.manufacturer ?? existing?.manufacturer ?? null,
    model: input.model ?? existing?.model ?? null,
    osVersion: input.osVersion ?? existing?.osVersion ?? null,
    locationPermissionStatus:
      input.locationPermissionStatus ?? existing?.locationPermissionStatus ?? null,
    callLogPermissionStatus:
      input.callLogPermissionStatus ?? existing?.callLogPermissionStatus ?? null,
    trackingEnabled: input.trackingEnabled ?? existing?.trackingEnabled ?? true,
    batteryLevel: input.batteryLevel ?? existing?.batteryLevel ?? null,
    networkStatus: input.networkStatus ?? existing?.networkStatus ?? null,
    lastSeenAt: now,
    lastHeartbeatAt: input.heartbeat !== false ? now : (existing?.lastHeartbeatAt ?? now),
    lastCallLogSyncAt: input.lastCallLogSyncAt ?? existing?.lastCallLogSyncAt ?? null,
    lastBootAt: input.lastBootAt ?? existing?.lastBootAt ?? null,
    queuedOfflinePingCount: input.queuedOfflinePingCount ?? existing?.queuedOfflinePingCount ?? 0,
    permissionDeniedCount: deniedCount,
    permissionDeniedAt: locationDenied ? (existing?.permissionDeniedAt ?? now) : null,
    batteryOptimizationIgnored:
      input.batteryOptimizationIgnored ?? existing?.batteryOptimizationIgnored ?? null,
    isCurrent: true,
    replacedAt: null,
    updatedAt: now,
  };

  let device: typeof agentDevices.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(agentDevices)
      .set(values)
      .where(eq(agentDevices.id, existing.id))
      .returning();
    device = updated!;
  } else {
    const [inserted] = await db.insert(agentDevices).values(values).returning();
    device = inserted!;
  }

  // Permission revocation events
  const newLoc = (input.locationPermissionStatus ?? "").toLowerCase();
  const oldLoc = (prevLocPerm ?? "").toLowerCase();
  if (
    (oldLoc === "granted" || oldLoc === "always") &&
    (newLoc === "denied" || newLoc.includes("revok"))
  ) {
    await upsertOpenTrackingAlert(db, {
      orgId,
      agentId: userId,
      deviceId: input.deviceId,
      alertType: "LOCATION_PERMISSION_REVOKED",
      severity: "CRITICAL",
      message: "Location permission changed from granted to denied/revoked.",
    });
  }

  const newCall = (input.callLogPermissionStatus ?? "").toUpperCase();
  const oldCall = (prevCallPerm ?? "").toUpperCase();
  if (oldCall === "GRANTED" && newCall === "DENIED") {
    await upsertOpenTrackingAlert(db, {
      orgId,
      agentId: userId,
      deviceId: input.deviceId,
      alertType: "CALL_LOG_PERMISSION_REVOKED",
      severity: "WARNING",
      message: "Call-log permission was revoked.",
    });
  }

  if (input.notifyPermissionDenied || (locationDenied && (input.permissionDeniedCount ?? 0) >= 3)) {
    await upsertOpenTrackingAlert(db, {
      orgId,
      agentId: userId,
      deviceId: input.deviceId,
      alertType: "LOCATION_PERMISSION_REVOKED",
      severity: "CRITICAL",
      message: `Agent denied background location (${deniedCount} prompt${deniedCount === 1 ? "" : "s"}).`,
    });
  }

  const [user] = await db
    .select({ trackingPolicyEnabled: users.trackingPolicyEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await evaluateDeviceHealthAndAlert(
    db,
    device,
    user?.trackingPolicyEnabled ?? true,
    config,
    orgId,
  );

  return device;
}

export async function recordSuccessfulLocationOnDevice(
  db: Database,
  userId: string,
  deviceId: string | null | undefined,
  loc: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    capturedAt: Date;
    batteryLevel?: number | null;
  },
): Promise<void> {
  if (!deviceId) return;
  const now = new Date();
  await db
    .update(agentDevices)
    .set({
      lastLocationAt: loc.capturedAt,
      lastKnownLatitude: loc.latitude,
      lastKnownLongitude: loc.longitude,
      lastKnownAccuracy: loc.accuracy,
      lastKnownCapturedAt: loc.capturedAt,
      lastSeenAt: now,
      agentStatus: "active",
      healthStatus: "ACTIVE",
      deviceStatus: "ONLINE",
      ...(loc.batteryLevel != null ? { batteryLevel: loc.batteryLevel } : {}),
      updatedAt: now,
    })
    .where(and(eq(agentDevices.userId, userId), eq(agentDevices.deviceId, deviceId)));
}
