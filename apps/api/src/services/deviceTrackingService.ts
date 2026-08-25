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

  const values = {
    userId,
    deviceId: input.deviceId,
    platform: input.platform,
    appVersion: input.appVersion ?? null,
    installationId: input.installationId ?? null,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    osVersion: input.osVersion ?? null,
    locationPermissionStatus: input.locationPermissionStatus ?? null,
    callLogPermissionStatus: input.callLogPermissionStatus ?? null,
    trackingEnabled: input.trackingEnabled ?? true,
    batteryLevel: input.batteryLevel ?? null,
    networkStatus: input.networkStatus ?? null,
    lastSeenAt: now,
    lastHeartbeatAt: input.heartbeat !== false ? now : (existing?.lastHeartbeatAt ?? now),
    lastCallLogSyncAt: input.lastCallLogSyncAt ?? existing?.lastCallLogSyncAt ?? null,
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
      updatedAt: now,
    })
    .where(and(eq(agentDevices.userId, userId), eq(agentDevices.deviceId, deviceId)));
}
