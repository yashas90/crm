import {
  agentCallLogs,
  agentDevices,
  agentLocations,
  trackingAuditLogs,
  users,
} from "@propninja/db";
import { getIstDateKey, istWallClockToDate } from "@propninja/types/ist";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../lib/db.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { getTrackingConfig, isTrackingCaptureAllowed } from "../lib/trackingConfig.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

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
  locationPermissionStatus: z.string().max(64).optional(),
  callLogPermissionStatus: z.string().max(64).optional(),
  trackingEnabled: z.boolean().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  networkStatus: z.enum(["online", "offline", "unknown"]).nullable().optional(),
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

function requireAdmin(authUser: AuthUser) {
  return authUser.role === "admin";
}

async function insertLocationPing(
  db: Database,
  userId: string,
  body: z.infer<typeof pingBodySchema>,
): Promise<"inserted" | "duplicate" | "outside_hours"> {
  const capturedAt = new Date(body.capturedAt);
  if (!isTrackingCaptureAllowed(capturedAt)) {
    return "outside_hours";
  }

  const values = {
    userId,
    eventId: body.eventId,
    deviceId: body.deviceId ?? null,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy ?? null,
    batteryLevel: body.batteryLevel ?? null,
    networkStatus: body.networkStatus ?? null,
    source: body.source ?? "mobile_background",
    speed: body.speed ?? null,
    heading: body.heading ?? null,
    altitude: body.altitude ?? null,
    capturedAt,
  };

  const inserted = await db
    .insert(agentLocations)
    .values(values)
    .onConflictDoNothing({ target: [agentLocations.userId, agentLocations.eventId] })
    .returning({ id: agentLocations.id });
  return inserted.length > 0 ? "inserted" : "duplicate";
}

locationRoutes.get("/config", (c) => {
  const config = getTrackingConfig();
  return jsonOk(c, {
    timezone: config.timezone,
    startTime: config.startTime,
    endTime: config.endTime,
    intervalMinutes: config.intervalMinutes,
    retentionDays: config.retentionDays,
    missingAlertMinutes: config.missingAlertMinutes,
    scheduleLabel: config.scheduleLabel,
    withinHours: isTrackingCaptureAllowed(new Date()),
  });
});

locationRoutes.post("/ping", writeRateLimit, validate("json", pingBodySchema), async (c) => {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const db = c.get("db");

  const result = await insertLocationPing(db, authUser.id, body);
  if (result === "outside_hours") {
    return jsonError(
      c,
      "OUTSIDE_TRACKING_HOURS",
      "Location updates are only accepted during configured working hours",
      422,
    );
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

    let inserted = 0;
    let duplicates = 0;
    let outsideHours = 0;

    for (const item of body.items) {
      const status = await insertLocationPing(db, authUser.id, item);
      if (status === "inserted") inserted += 1;
      else if (status === "duplicate") duplicates += 1;
      else outsideHours += 1;
    }

    return jsonOk(c, { inserted, duplicates, outsideHours }, undefined, 201);
  },
);

locationRoutes.post("/device", writeRateLimit, validate("json", deviceBodySchema), async (c) => {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const db = c.get("db");
  const now = new Date();

  await db
    .insert(agentDevices)
    .values({
      userId: authUser.id,
      deviceId: body.deviceId,
      platform: body.platform,
      appVersion: body.appVersion ?? null,
      locationPermissionStatus: body.locationPermissionStatus ?? null,
      callLogPermissionStatus: body.callLogPermissionStatus ?? null,
      trackingEnabled: body.trackingEnabled ?? true,
      batteryLevel: body.batteryLevel ?? null,
      networkStatus: body.networkStatus ?? null,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [agentDevices.userId, agentDevices.deviceId],
      set: {
        platform: body.platform,
        appVersion: body.appVersion ?? null,
        locationPermissionStatus: body.locationPermissionStatus ?? null,
        callLogPermissionStatus: body.callLogPermissionStatus ?? null,
        trackingEnabled: body.trackingEnabled ?? true,
        batteryLevel: body.batteryLevel ?? null,
        networkStatus: body.networkStatus ?? null,
        lastSeenAt: now,
        updatedAt: now,
      },
    });

  return jsonOk(c, { ok: true as const });
});

locationRoutes.post(
  "/call-logs/bulk",
  writeRateLimit,
  validate("json", bulkCallLogsSchema),
  async (c) => {
    const authUser = c.get("authUser");
    const body = c.req.valid("json");
    const db = c.get("db");
    const { retentionDays } = getTrackingConfig();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    let inserted = 0;
    let duplicates = 0;
    let skipped = 0;

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

      if (rows.length > 0) inserted += 1;
      else duplicates += 1;
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
  const config = getTrackingConfig();
  const withinHours = isTrackingCaptureAllowed(new Date());

  await db.insert(trackingAuditLogs).values({
    adminId: authUser.id,
    action: "VIEW_LIVE_LOCATIONS",
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: c.req.header("user-agent")?.slice(0, 256) ?? null,
  });

  const rows = await db.execute<{
    user_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    captured_at: Date | string;
    battery_level: number | null;
    network_status: string | null;
    name: string;
    email: string;
    location_permission_status: string | null;
    call_log_permission_status: string | null;
    device_platform: string | null;
    app_version: string | null;
    tracking_enabled: boolean | null;
  }>(sql`
    SELECT DISTINCT ON (loc.user_id)
      loc.user_id AS user_id,
      loc.latitude AS latitude,
      loc.longitude AS longitude,
      loc.accuracy AS accuracy,
      loc.captured_at AS captured_at,
      loc.battery_level AS battery_level,
      loc.network_status AS network_status,
      u.name AS name,
      u.email AS email,
      d.location_permission_status AS location_permission_status,
      d.call_log_permission_status AS call_log_permission_status,
      d.platform AS device_platform,
      d.app_version AS app_version,
      d.tracking_enabled AS tracking_enabled
    FROM agent_locations loc
    INNER JOIN users u ON u.id = loc.user_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM agent_devices
      WHERE user_id = loc.user_id
      ORDER BY last_seen_at DESC
      LIMIT 1
    ) d ON true
    WHERE loc.captured_at > NOW() - INTERVAL '24 hours'
    ORDER BY loc.user_id, loc.captured_at DESC
  `);

  const agents = rows.map((row) => {
    const capturedAt =
      row.captured_at instanceof Date
        ? row.captured_at.toISOString()
        : new Date(row.captured_at).toISOString();
    const minutesSince = Math.floor((Date.now() - new Date(capturedAt).getTime()) / 60_000);
    let trackingStatus: AgentLocationPingStatus = "active";
    if (row.location_permission_status && row.location_permission_status !== "granted") {
      trackingStatus = "permission_denied";
    } else if (!withinHours) {
      trackingStatus = "outside_hours";
    } else if (row.tracking_enabled === false) {
      trackingStatus = "inactive";
    } else if (minutesSince >= config.missingAlertMinutes) {
      trackingStatus = "stale";
    }

    return {
      userId: row.user_id,
      name: row.name,
      email: row.email,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      accuracy: row.accuracy == null ? null : Number(row.accuracy),
      capturedAt,
      batteryLevel: row.battery_level,
      networkStatus: row.network_status,
      trackingStatus,
      locationPermissionStatus: row.location_permission_status,
      callLogPermissionStatus: row.call_log_permission_status,
      devicePlatform: row.device_platform,
      appVersion: row.app_version,
      minutesSinceLastPing: minutesSince,
    };
  });

  return jsonOk(c, {
    agents,
    config: {
      scheduleLabel: config.scheduleLabel,
      intervalMinutes: config.intervalMinutes,
      retentionDays: config.retentionDays,
      missingAlertMinutes: config.missingAlertMinutes,
      withinHours,
    },
  });
});

type AgentLocationPingStatus =
  | "active"
  | "inactive"
  | "outside_hours"
  | "permission_denied"
  | "stale";

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
    // Mask middle digits for admin UI privacy.
    phoneNumber: row.phoneNumber ? row.phoneNumber.replace(/(\d{2})\d+(\d{2})/, "$1****$2") : null,
    callStartTime: row.callStartTime.toISOString(),
    callEndTime: row.callEndTime?.toISOString() ?? null,
    durationSeconds: row.durationSeconds,
  }));

  return jsonOk(c, { items, total: items.length });
});
