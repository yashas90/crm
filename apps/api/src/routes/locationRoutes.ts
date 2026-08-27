import {
  agentCallLogs,
  agentDevices,
  agentLocations,
  trackingAuditLogs,
  trackingSettings,
  users,
} from "@propninja/db";
import { getIstDateKey, istWallClockToDate } from "@propninja/types/ist";
import { deriveAgentAvailabilityStatus, isLastKnownLocation } from "@propninja/types/tracking";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../lib/db.js";
import { jsonError, jsonOk } from "../lib/response.js";
import {
  getTrackingConfig,
  getTrackingConfigForOrg,
  isTrackingCaptureAllowed,
} from "../lib/trackingConfig.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import {
  recordSuccessfulLocationOnDevice,
  upsertAgentDevice,
} from "../services/deviceTrackingService.js";
import { listOpenTrackingAlerts } from "../services/trackingAlertService.js";

export const locationRoutes = new Hono();

const pingFields = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  capturedAt: z.string().datetime({ offset: true }),
  eventId: z.string().min(8).max(128),
  deviceId: z.string().min(1).max(128).optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  networkStatus: z.enum(["online", "offline", "unknown"]).nullable().optional(),
  source: z.string().max(64).optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  altitude: z.number().nullable().optional(),
};

const pingBodySchema = z.object(pingFields);

const bulkPingBodySchema = z.object({
  items: z.array(z.object(pingFields)).min(1).max(100),
});

const deviceBodySchema = z.object({
  deviceId: z.string().min(1).max(128),
  platform: z.enum(["android", "ios", "web"]),
  appVersion: z.string().max(32).optional(),
  installationId: z.string().max(128).optional(),
  manufacturer: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  osVersion: z.string().max(64).optional(),
  locationPermissionStatus: z.string().max(64).optional(),
  callLogPermissionStatus: z.string().max(64).optional(),
  trackingEnabled: z.boolean().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  networkStatus: z.enum(["online", "offline", "unknown"]).nullable().optional(),
  heartbeat: z.boolean().optional(),
  lastBootAt: z.string().datetime({ offset: true }).nullable().optional(),
  queuedOfflinePingCount: z.number().int().min(0).max(500).optional(),
  permissionDeniedCount: z.number().int().min(0).max(99).optional(),
  batteryOptimizationIgnored: z.boolean().optional(),
  notifyPermissionDenied: z.boolean().optional(),
});

const heartbeatBodySchema = z.object({
  deviceId: z.string().min(1).max(128),
  platform: z.enum(["android", "ios", "web"]),
  appVersion: z.string().max(32).optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  networkStatus: z.enum(["online", "offline", "unknown"]).nullable().optional(),
  lastBootAt: z.string().datetime({ offset: true }).nullable().optional(),
  queuedOfflinePingCount: z.number().int().min(0).max(500).optional(),
});

const callLogItemSchema = z.object({
  eventId: z.string().min(8).max(128),
  deviceId: z.string().min(1).max(128),
  callLogId: z.string().max(128).nullable().optional(),
  phoneNumber: z.string().max(32).nullable().optional(),
  callType: z.enum(["INCOMING", "OUTGOING", "MISSED", "REJECTED", "UNKNOWN"]),
  callStartTime: z.string().datetime({ offset: true }),
  callEndTime: z.string().datetime({ offset: true }).nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
});

const bulkCallLogsSchema = z.object({
  items: z.array(callLogItemSchema).min(1).max(200),
});

const historyQuerySchema = z.object({
  userId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const settingsBodySchema = z.object({
  enabled: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  intervalMinutes: z.number().int().positive().max(240).optional(),
  retentionDays: z.number().int().positive().max(90).optional(),
  missingAlertMinutes: z.number().int().positive().max(1440).optional(),
  heartbeatThresholdMinutes: z.number().int().positive().max(1440).optional(),
  possibleUninstallMinutes: z.number().int().positive().max(10080).optional(),
  activeDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
});

const agentIdParamSchema = z.object({ agentId: z.string().uuid() });

function requireAdmin(authUser: AuthUser) {
  return authUser.role === "admin";
}

async function insertLocationPing(
  db: Database,
  userId: string,
  body: z.infer<typeof pingBodySchema>,
  config = getTrackingConfig(),
): Promise<"inserted" | "duplicate" | "outside_hours" | "disabled"> {
  if (!config.enabled) return "disabled";
  const capturedAt = new Date(body.capturedAt);
  if (!isTrackingCaptureAllowed(capturedAt, config)) {
    return "outside_hours";
  }

  const normalizedSource = normalizePingSource(body.source);

  const values = {
    userId,
    eventId: body.eventId,
    deviceId: body.deviceId ?? null,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy ?? null,
    batteryLevel: body.batteryLevel ?? null,
    networkStatus: body.networkStatus ?? null,
    source: normalizedSource,
    speed: body.speed ?? null,
    heading: body.heading ?? null,
    altitude: body.altitude ?? null,
    capturedAt,
  };

  // Prefer no explicit conflict target so inserts still work if the unique index
  // is partial (historical drift) or renamed — ON CONFLICT DO NOTHING catches all.
  const inserted = await db
    .insert(agentLocations)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: agentLocations.id });

  if (inserted.length > 0) {
    await recordSuccessfulLocationOnDevice(db, userId, body.deviceId, {
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? null,
      capturedAt,
      batteryLevel: body.batteryLevel ?? null,
    });
    // Spec: keep last 100 pings per agent in location history.
    await pruneAgentLocationHistory(db, userId, 100);
  }

  return inserted.length > 0 ? "inserted" : "duplicate";
}

/** Map mobile sources onto the spec enum: foreground | background | terminated. */
function normalizePingSource(source: string | undefined): string {
  const raw = (source ?? "background").toLowerCase();
  if (raw === "foreground" || raw === "mobile_foreground") return "foreground";
  if (
    raw === "terminated" ||
    raw === "mobile_terminated" ||
    raw.includes("watchdog") ||
    raw.includes("catchup")
  ) {
    return "terminated";
  }
  return "background";
}

async function pruneAgentLocationHistory(
  db: Database,
  userId: string,
  keepLast: number,
): Promise<void> {
  await db.execute(sql`
    DELETE FROM agent_locations
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (ORDER BY captured_at DESC) AS rn
        FROM agent_locations
        WHERE user_id = ${userId}
      ) ranked
      WHERE rn > ${keepLast}
    )
  `);
}

locationRoutes.get("/config", async (c) => {
  const authUser = c.get("authUser");
  const db = c.get("db");
  const config = await getTrackingConfigForOrg(db, authUser.orgId);
  const [me] = await db
    .select({ trackingPolicyEnabled: users.trackingPolicyEnabled })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  return jsonOk(c, {
    enabled: config.enabled,
    timezone: config.timezone,
    startTime: config.startTime,
    endTime: config.endTime,
    intervalMinutes: config.intervalMinutes,
    retentionDays: config.retentionDays,
    missingAlertMinutes: config.missingAlertMinutes,
    heartbeatThresholdMinutes: config.heartbeatThresholdMinutes,
    possibleUninstallMinutes: config.possibleUninstallMinutes,
    activeDays: config.activeDays,
    scheduleLabel: config.scheduleLabel,
    withinHours: isTrackingCaptureAllowed(new Date(), config),
    trackingPolicyEnabled: me?.trackingPolicyEnabled ?? true,
  });
});

locationRoutes.get("/me/status", async (c) => {
  const authUser = c.get("authUser");
  const db = c.get("db");
  const config = await getTrackingConfigForOrg(db, authUser.orgId);
  const [me] = await db
    .select({ trackingPolicyEnabled: users.trackingPolicyEnabled })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  const [device] = await db
    .select()
    .from(agentDevices)
    .where(and(eq(agentDevices.userId, authUser.id), eq(agentDevices.isCurrent, true)))
    .orderBy(desc(agentDevices.lastSeenAt))
    .limit(1);

  return jsonOk(c, {
    config: {
      enabled: config.enabled,
      scheduleLabel: config.scheduleLabel,
      startTime: config.startTime,
      endTime: config.endTime,
      withinHours: isTrackingCaptureAllowed(new Date(), config),
    },
    trackingPolicyEnabled: me?.trackingPolicyEnabled ?? true,
    device: device
      ? {
          deviceId: device.deviceId,
          platform: device.platform,
          appVersion: device.appVersion,
          locationPermissionStatus: device.locationPermissionStatus,
          callLogPermissionStatus: device.callLogPermissionStatus,
          healthStatus: device.healthStatus,
          agentStatus: device.agentStatus,
          deviceStatus: device.deviceStatus,
          batteryLevel: device.batteryLevel,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
          lastLocationAt: device.lastLocationAt?.toISOString() ?? null,
          lastKnownLatitude: device.lastKnownLatitude,
          lastKnownLongitude: device.lastKnownLongitude,
          lastKnownAccuracy: device.lastKnownAccuracy,
          lastKnownCapturedAt: device.lastKnownCapturedAt?.toISOString() ?? null,
        }
      : null,
  });
});

locationRoutes.post("/ping", writeRateLimit, validate("json", pingBodySchema), async (c) => {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const db = c.get("db");
  const config = await getTrackingConfigForOrg(db, authUser.orgId);

  const [me] = await db
    .select({ trackingPolicyEnabled: users.trackingPolicyEnabled })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  if (me && me.trackingPolicyEnabled === false) {
    return jsonError(c, "TRACKING_DISABLED", "Tracking disabled for this agent", 403);
  }

  const result = await insertLocationPing(db, authUser.id, body, config);
  if (result === "outside_hours") {
    return jsonError(
      c,
      "OUTSIDE_TRACKING_HOURS",
      "Location updates are only accepted during configured working hours",
      422,
    );
  }
  if (result === "disabled") {
    return jsonError(c, "TRACKING_DISABLED", "Tracking is disabled", 403);
  }

  return jsonOk(
    c,
    { ok: true as const, status: result },
    undefined,
    result === "inserted" ? 201 : 200,
  );
});

locationRoutes.post(
  "/ping/bulk",
  writeRateLimit,
  validate("json", bulkPingBodySchema),
  async (c) => {
    const authUser = c.get("authUser");
    const body = c.req.valid("json");
    const db = c.get("db");
    const config = await getTrackingConfigForOrg(db, authUser.orgId);

    let inserted = 0;
    let duplicates = 0;
    let outsideHours = 0;
    let disabled = 0;
    const acceptedEventIds: string[] = [];
    const rejectedOutsideHoursEventIds: string[] = [];
    const rejectedDisabledEventIds: string[] = [];

    for (const item of body.items) {
      const status = await insertLocationPing(db, authUser.id, item, config);
      if (status === "inserted") {
        inserted += 1;
        acceptedEventIds.push(item.eventId);
      } else if (status === "duplicate") {
        duplicates += 1;
        acceptedEventIds.push(item.eventId);
      } else if (status === "disabled") {
        disabled += 1;
        rejectedDisabledEventIds.push(item.eventId);
      } else {
        outsideHours += 1;
        rejectedOutsideHoursEventIds.push(item.eventId);
      }
    }

    return jsonOk(
      c,
      {
        inserted,
        duplicates,
        outsideHours,
        disabled,
        acceptedEventIds,
        rejectedOutsideHoursEventIds,
        rejectedDisabledEventIds,
      },
      undefined,
      201,
    );
  },
);

locationRoutes.post("/device", writeRateLimit, validate("json", deviceBodySchema), async (c) => {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const db = c.get("db");
  const config = await getTrackingConfigForOrg(db, authUser.orgId);

  const device = await upsertAgentDevice(
    db,
    authUser.id,
    authUser.orgId,
    {
      ...body,
      lastBootAt: body.lastBootAt ? new Date(body.lastBootAt) : null,
      queuedOfflinePingCount: body.queuedOfflinePingCount,
      permissionDeniedCount: body.permissionDeniedCount,
      batteryOptimizationIgnored: body.batteryOptimizationIgnored,
      notifyPermissionDenied: body.notifyPermissionDenied,
      heartbeat: body.heartbeat !== false,
    },
    config,
  );

  return jsonOk(c, {
    ok: true as const,
    healthStatus: device.healthStatus,
    deviceStatus: device.deviceStatus,
  });
});

locationRoutes.post(
  "/device/heartbeat",
  writeRateLimit,
  validate("json", heartbeatBodySchema),
  async (c) => {
    const authUser = c.get("authUser");
    const body = c.req.valid("json");
    const db = c.get("db");
    const config = await getTrackingConfigForOrg(db, authUser.orgId);
    const device = await upsertAgentDevice(
      db,
      authUser.id,
      authUser.orgId,
      {
        deviceId: body.deviceId,
        platform: body.platform,
        appVersion: body.appVersion,
        batteryLevel: body.batteryLevel,
        networkStatus: body.networkStatus,
        lastBootAt: body.lastBootAt ? new Date(body.lastBootAt) : undefined,
        queuedOfflinePingCount: body.queuedOfflinePingCount,
        heartbeat: true,
      },
      config,
    );
    return jsonOk(c, {
      ok: true as const,
      healthStatus: device.healthStatus,
      lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    });
  },
);

locationRoutes.post(
  "/call-logs/bulk",
  writeRateLimit,
  validate("json", bulkCallLogsSchema),
  async (c) => {
    const authUser = c.get("authUser");
    const body = c.req.valid("json");
    const db = c.get("db");
    const config = await getTrackingConfigForOrg(db, authUser.orgId);
    const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;

    let inserted = 0;
    let duplicates = 0;
    let skipped = 0;
    let lastDeviceId: string | null = null;

    for (const item of body.items) {
      const start = new Date(item.callStartTime);
      if (start.getTime() < cutoff) {
        skipped += 1;
        continue;
      }

      const rows = await db
        .insert(agentCallLogs)
        .values({
          eventId: item.eventId,
          userId: authUser.id,
          deviceId: item.deviceId,
          callLogId: item.callLogId ?? null,
          phoneNumber: item.phoneNumber ?? null,
          callType: item.callType,
          callStartTime: start,
          callEndTime: item.callEndTime ? new Date(item.callEndTime) : null,
          durationSeconds: item.durationSeconds ?? null,
        })
        .onConflictDoNothing({ target: [agentCallLogs.userId, agentCallLogs.eventId] })
        .returning({ id: agentCallLogs.id });

      if (rows.length > 0) {
        inserted += 1;
        lastDeviceId = item.deviceId;
      } else duplicates += 1;
    }

    if (lastDeviceId) {
      await db
        .update(agentDevices)
        .set({ lastCallLogSyncAt: new Date(), updatedAt: new Date() })
        .where(and(eq(agentDevices.userId, authUser.id), eq(agentDevices.deviceId, lastDeviceId)));
    }

    return jsonOk(c, { inserted, duplicates, skipped }, undefined, 201);
  },
);

locationRoutes.get("/live", async (c) => {
  const authUser = c.get("authUser");
  if (!requireAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const db = c.get("db");
  const config = await getTrackingConfigForOrg(db, authUser.orgId);
  const withinHours = isTrackingCaptureAllowed(new Date(), config);

  await db.insert(trackingAuditLogs).values({
    adminId: authUser.id,
    action: "VIEW_LIVE_LOCATIONS",
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: c.req.header("user-agent")?.slice(0, 256) ?? null,
  });

  const rows = await db.execute<{
    user_id: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    captured_at: Date | string | null;
    battery_level: number | null;
    network_status: string | null;
    name: string;
    email: string;
    location_permission_status: string | null;
    call_log_permission_status: string | null;
    device_platform: string | null;
    app_version: string | null;
    tracking_enabled: boolean | null;
    health_status: string | null;
    device_status: string | null;
    agent_status: string | null;
    last_seen_at: Date | string | null;
    last_heartbeat_at: Date | string | null;
    last_location_at: Date | string | null;
    last_boot_at: Date | string | null;
    queued_offline_ping_count: number | null;
    tracking_policy_enabled: boolean;
  }>(sql`
    SELECT
      u.id AS user_id,
      u.name AS name,
      u.email AS email,
      u.tracking_policy_enabled AS tracking_policy_enabled,
      COALESCE(d.last_known_latitude, loc.latitude) AS latitude,
      COALESCE(d.last_known_longitude, loc.longitude) AS longitude,
      COALESCE(d.last_known_accuracy, loc.accuracy) AS accuracy,
      COALESCE(d.last_known_captured_at, loc.captured_at) AS captured_at,
      d.battery_level AS battery_level,
      d.network_status AS network_status,
      d.location_permission_status AS location_permission_status,
      d.call_log_permission_status AS call_log_permission_status,
      d.platform AS device_platform,
      d.app_version AS app_version,
      d.tracking_enabled AS tracking_enabled,
      d.health_status AS health_status,
      d.device_status AS device_status,
      d.agent_status AS agent_status,
      d.last_seen_at AS last_seen_at,
      d.last_heartbeat_at AS last_heartbeat_at,
      d.last_location_at AS last_location_at,
      d.last_boot_at AS last_boot_at,
      d.queued_offline_ping_count AS queued_offline_ping_count
    FROM users u
    LEFT JOIN LATERAL (
      SELECT *
      FROM agent_devices
      WHERE user_id = u.id AND is_current = true
      ORDER BY last_seen_at DESC
      LIMIT 1
    ) d ON true
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, accuracy, captured_at
      FROM agent_locations
      WHERE user_id = u.id
      ORDER BY captured_at DESC
      LIMIT 1
    ) loc ON true
    WHERE u.role = 'agent' AND u.is_active = true AND u.org_id = ${authUser.orgId}
    ORDER BY u.name ASC
  `);

  const deviceRows = await db.execute<{
    user_id: string;
    device_id: string;
    platform: string;
    app_version: string | null;
    location_permission_status: string | null;
    call_log_permission_status: string | null;
    tracking_enabled: boolean;
    last_seen_at: Date | string;
    network_status: string | null;
    battery_level: number | null;
    name: string;
    email: string;
  }>(sql`
    SELECT DISTINCT ON (d.user_id)
      d.user_id AS user_id,
      d.device_id AS device_id,
      d.platform AS platform,
      d.app_version AS app_version,
      d.location_permission_status AS location_permission_status,
      d.call_log_permission_status AS call_log_permission_status,
      d.tracking_enabled AS tracking_enabled,
      d.last_seen_at AS last_seen_at,
      d.network_status AS network_status,
      d.battery_level AS battery_level,
      u.name AS name,
      u.email AS email
    FROM agent_devices d
    INNER JOIN users u ON u.id = d.user_id
    WHERE u.role = 'agent' AND u.is_active = true
    ORDER BY d.user_id, d.last_seen_at DESC
  `);

  const agents = rows.map((row) => {
    const capturedAt = row.captured_at
      ? row.captured_at instanceof Date
        ? row.captured_at.toISOString()
        : new Date(row.captured_at).toISOString()
      : null;
    const lastSeenAt = row.last_seen_at
      ? row.last_seen_at instanceof Date
        ? row.last_seen_at.toISOString()
        : new Date(row.last_seen_at).toISOString()
      : null;
    const lastLocationAt = row.last_location_at
      ? new Date(row.last_location_at)
      : capturedAt
        ? new Date(capturedAt)
        : null;
    const lastBootAt = row.last_boot_at ? new Date(row.last_boot_at) : null;
    const minutesSince = capturedAt
      ? Math.floor((Date.now() - new Date(capturedAt).getTime()) / 60_000)
      : null;
    const agentStatus = deriveAgentAvailabilityStatus({
      trackingPolicyEnabled: row.tracking_policy_enabled,
      trackingEnabledGlobal: config.enabled,
      clientTrackingEnabled: row.tracking_enabled,
      lastLocationAt,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : lastLocationAt,
      lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at) : null,
      lastBootAt,
      hasQueuedOfflinePings: (row.queued_offline_ping_count ?? 0) > 0,
      missingAlertMinutes: config.missingAlertMinutes,
      possibleUninstallMinutes: config.possibleUninstallMinutes,
      schedule: config.schedule,
      withinHours,
    });
    const isStale = agentStatus === "stale";
    const lastKnown = isLastKnownLocation({
      lastLocationAt,
      missingAlertMinutes: config.missingAlertMinutes,
      schedule: config.schedule,
      withinHours,
    });

    return {
      userId: row.user_id,
      name: row.name,
      email: row.email,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      accuracy: row.accuracy == null ? null : Number(row.accuracy),
      capturedAt,
      lastSeenAt,
      lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).toISOString() : null,
      lastLocationAt: lastLocationAt?.toISOString() ?? null,
      batteryLevel: row.battery_level,
      networkStatus: row.network_status,
      trackingStatus: (row.health_status ?? "UNKNOWN").toLowerCase(),
      healthStatus: row.health_status ?? "UNKNOWN",
      agentStatus,
      deviceStatus: row.device_status ?? "UNKNOWN",
      locationPermissionStatus: row.location_permission_status,
      callLogPermissionStatus: row.call_log_permission_status,
      devicePlatform: row.device_platform,
      appVersion: row.app_version,
      minutesSinceLastPing: minutesSince,
      isLastKnown: lastKnown,
      isStale,
      locationLabel: lastKnown ? "LAST_KNOWN_LOCATION" : "CURRENT_LOCATION",
      trackingPolicyEnabled: row.tracking_policy_enabled,
      withinHours,
    };
  });

  const devices = deviceRows.map((row) => {
    const lastSeenAt =
      row.last_seen_at instanceof Date
        ? row.last_seen_at.toISOString()
        : new Date(row.last_seen_at).toISOString();
    return {
      userId: row.user_id,
      name: row.name,
      email: row.email,
      deviceId: row.device_id,
      platform: row.platform,
      appVersion: row.app_version,
      locationPermissionStatus: row.location_permission_status,
      callLogPermissionStatus: row.call_log_permission_status,
      trackingEnabled: row.tracking_enabled,
      lastSeenAt,
      networkStatus: row.network_status,
      batteryLevel: row.battery_level,
      minutesSinceDeviceSeen: Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60_000),
    };
  });

  return jsonOk(c, {
    agents,
    devices,
    config: {
      enabled: config.enabled,
      scheduleLabel: config.scheduleLabel,
      intervalMinutes: config.intervalMinutes,
      retentionDays: config.retentionDays,
      missingAlertMinutes: config.missingAlertMinutes,
      heartbeatThresholdMinutes: config.heartbeatThresholdMinutes,
      possibleUninstallMinutes: config.possibleUninstallMinutes,
      withinHours,
    },
  });
});

locationRoutes.get("/health", async (c) => {
  const authUser = c.get("authUser");
  if (!requireAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  const db = c.get("db");
  await db.insert(trackingAuditLogs).values({
    adminId: authUser.id,
    action: "VIEW_DEVICE_STATUS",
  });

  const config = await getTrackingConfigForOrg(db, authUser.orgId);
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      trackingPolicyEnabled: users.trackingPolicyEnabled,
      deviceId: agentDevices.deviceId,
      platform: agentDevices.platform,
      model: agentDevices.model,
      manufacturer: agentDevices.manufacturer,
      appVersion: agentDevices.appVersion,
      healthStatus: agentDevices.healthStatus,
      agentStatus: agentDevices.agentStatus,
      deviceStatus: agentDevices.deviceStatus,
      locationPermissionStatus: agentDevices.locationPermissionStatus,
      callLogPermissionStatus: agentDevices.callLogPermissionStatus,
      lastSeenAt: agentDevices.lastSeenAt,
      lastLocationAt: agentDevices.lastLocationAt,
      lastKnownLatitude: agentDevices.lastKnownLatitude,
      lastKnownLongitude: agentDevices.lastKnownLongitude,
      lastKnownCapturedAt: agentDevices.lastKnownCapturedAt,
      batteryLevel: agentDevices.batteryLevel,
      isCurrent: agentDevices.isCurrent,
    })
    .from(users)
    .leftJoin(
      agentDevices,
      and(eq(agentDevices.userId, users.id), eq(agentDevices.isCurrent, true)),
    )
    .where(and(eq(users.orgId, authUser.orgId), eq(users.role, "agent"), eq(users.isActive, true)))
    .orderBy(asc(users.name));

  return jsonOk(c, {
    agents: rows.map((r) => ({
      ...r,
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      lastLocationAt: r.lastLocationAt?.toISOString() ?? null,
      lastKnownCapturedAt: r.lastKnownCapturedAt?.toISOString() ?? null,
    })),
    config: {
      scheduleLabel: config.scheduleLabel,
      heartbeatThresholdMinutes: config.heartbeatThresholdMinutes,
      missingAlertMinutes: config.missingAlertMinutes,
    },
  });
});

locationRoutes.get("/alerts", async (c) => {
  const authUser = c.get("authUser");
  if (!requireAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  const db = c.get("db");
  const alerts = await listOpenTrackingAlerts(db, authUser.orgId);
  return jsonOk(c, {
    alerts: alerts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

locationRoutes.get("/settings", async (c) => {
  const authUser = c.get("authUser");
  if (!requireAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  const db = c.get("db");
  const config = await getTrackingConfigForOrg(db, authUser.orgId);
  return jsonOk(c, config);
});

locationRoutes.patch(
  "/settings",
  writeRateLimit,
  validate("json", settingsBodySchema),
  async (c) => {
    const authUser = c.get("authUser");
    if (!requireAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Access denied", 403);
    }
    const body = c.req.valid("json");
    const db = c.get("db");
    const now = new Date();
    const current = await getTrackingConfigForOrg(db, authUser.orgId);

    await db
      .insert(trackingSettings)
      .values({
        orgId: authUser.orgId,
        enabled: body.enabled ?? current.enabled,
        timezone: body.timezone ?? current.timezone,
        startTime: body.startTime ?? current.startTime,
        endTime: body.endTime ?? current.endTime,
        intervalMinutes: body.intervalMinutes ?? current.intervalMinutes,
        retentionDays: body.retentionDays ?? current.retentionDays,
        missingAlertMinutes: body.missingAlertMinutes ?? current.missingAlertMinutes,
        heartbeatThresholdMinutes:
          body.heartbeatThresholdMinutes ?? current.heartbeatThresholdMinutes,
        possibleUninstallMinutes: body.possibleUninstallMinutes ?? current.possibleUninstallMinutes,
        activeDays: body.activeDays ?? current.activeDays,
        updatedBy: authUser.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [trackingSettings.orgId],
        set: {
          enabled: body.enabled ?? current.enabled,
          timezone: body.timezone ?? current.timezone,
          startTime: body.startTime ?? current.startTime,
          endTime: body.endTime ?? current.endTime,
          intervalMinutes: body.intervalMinutes ?? current.intervalMinutes,
          retentionDays: body.retentionDays ?? current.retentionDays,
          missingAlertMinutes: body.missingAlertMinutes ?? current.missingAlertMinutes,
          heartbeatThresholdMinutes:
            body.heartbeatThresholdMinutes ?? current.heartbeatThresholdMinutes,
          possibleUninstallMinutes:
            body.possibleUninstallMinutes ?? current.possibleUninstallMinutes,
          activeDays: body.activeDays ?? current.activeDays,
          updatedBy: authUser.id,
          updatedAt: now,
        },
      });

    await db.insert(trackingAuditLogs).values({
      adminId: authUser.id,
      action: "CHANGE_TRACKING_SETTINGS",
    });

    const next = await getTrackingConfigForOrg(db, authUser.orgId);
    return jsonOk(c, next);
  },
);

locationRoutes.post(
  "/agents/:agentId/enable",
  writeRateLimit,
  validate("param", agentIdParamSchema),
  async (c) => {
    const authUser = c.get("authUser");
    if (!requireAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Access denied", 403);
    }
    const { agentId } = c.req.valid("param");
    const db = c.get("db");
    await db
      .update(users)
      .set({ trackingPolicyEnabled: true })
      .where(and(eq(users.id, agentId), eq(users.orgId, authUser.orgId)));
    await db.insert(trackingAuditLogs).values({
      adminId: authUser.id,
      action: "ENABLE_TRACKING",
      agentId,
    });
    return jsonOk(c, { ok: true as const, trackingPolicyEnabled: true });
  },
);

locationRoutes.post(
  "/agents/:agentId/disable",
  writeRateLimit,
  validate("param", agentIdParamSchema),
  async (c) => {
    const authUser = c.get("authUser");
    if (!requireAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Access denied", 403);
    }
    const { agentId } = c.req.valid("param");
    const db = c.get("db");
    await db
      .update(users)
      .set({ trackingPolicyEnabled: false })
      .where(and(eq(users.id, agentId), eq(users.orgId, authUser.orgId)));
    await db.insert(trackingAuditLogs).values({
      adminId: authUser.id,
      action: "DISABLE_TRACKING",
      agentId,
    });
    return jsonOk(c, { ok: true as const, trackingPolicyEnabled: false });
  },
);

locationRoutes.get("/history", validate("query", historyQuerySchema), async (c) => {
  const authUser = c.get("authUser");
  if (!requireAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const { userId, date } = c.req.valid("query");
  const dateKey = date ?? getIstDateKey();
  const dayStart = istWallClockToDate(dateKey, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const db = c.get("db");

  await db.insert(trackingAuditLogs).values({
    adminId: authUser.id,
    action: "VIEW_LOCATION_HISTORY",
    agentId: userId,
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: c.req.header("user-agent")?.slice(0, 256) ?? null,
  });

  const rows = await db
    .select({
      id: agentLocations.id,
      latitude: agentLocations.latitude,
      longitude: agentLocations.longitude,
      accuracy: agentLocations.accuracy,
      capturedAt: agentLocations.capturedAt,
      batteryLevel: agentLocations.batteryLevel,
      networkStatus: agentLocations.networkStatus,
    })
    .from(agentLocations)
    .where(
      and(
        eq(agentLocations.userId, userId),
        gte(agentLocations.capturedAt, dayStart),
        lte(agentLocations.capturedAt, dayEnd),
      ),
    )
    .orderBy(asc(agentLocations.capturedAt));

  const items = rows.map((row) => ({
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    capturedAt: row.capturedAt.toISOString(),
    batteryLevel: row.batteryLevel,
    networkStatus: row.networkStatus,
  }));

  const expectedIntervalMs = getTrackingConfig().intervalMinutes * 60_000;
  const gaps: Array<{ from: string; to: string; minutes: number }> = [];
  for (let i = 1; i < items.length; i += 1) {
    const prev = items[i - 1];
    const curr = items[i];
    if (!prev || !curr) continue;
    const delta = new Date(curr.capturedAt).getTime() - new Date(prev.capturedAt).getTime();
    if (delta > expectedIntervalMs * 1.75) {
      gaps.push({
        from: prev.capturedAt,
        to: curr.capturedAt,
        minutes: Math.round(delta / 60_000),
      });
    }
  }

  return jsonOk(c, { items, total: items.length, gaps });
});

locationRoutes.get("/call-logs", validate("query", historyQuerySchema), async (c) => {
  const authUser = c.get("authUser");
  if (!requireAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const { userId, date } = c.req.valid("query");
  const dateKey = date ?? getIstDateKey();
  const dayStart = istWallClockToDate(dateKey, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const db = c.get("db");

  await db.insert(trackingAuditLogs).values({
    adminId: authUser.id,
    action: "VIEW_CALL_LOG",
    agentId: userId,
  });

  const rows = await db
    .select({
      id: agentCallLogs.id,
      callType: agentCallLogs.callType,
      phoneNumber: agentCallLogs.phoneNumber,
      callStartTime: agentCallLogs.callStartTime,
      callEndTime: agentCallLogs.callEndTime,
      durationSeconds: agentCallLogs.durationSeconds,
    })
    .from(agentCallLogs)
    .where(
      and(
        eq(agentCallLogs.userId, userId),
        gte(agentCallLogs.callStartTime, dayStart),
        lte(agentCallLogs.callStartTime, dayEnd),
      ),
    )
    .orderBy(asc(agentCallLogs.callStartTime));

  const items = rows.map((row) => ({
    id: row.id,
    callType: row.callType,
    phoneNumber: row.phoneNumber,
    callStartTime: row.callStartTime.toISOString(),
    callEndTime: row.callEndTime?.toISOString() ?? null,
    durationSeconds: row.durationSeconds,
  }));

  return jsonOk(c, { items, total: items.length });
});
