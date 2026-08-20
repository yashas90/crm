import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturning = vi.fn();
const insertOnConflict = vi.fn(() => ({ returning: insertReturning }));
const insertOnConflictUpdate = vi.fn().mockResolvedValue(undefined);
const insertValues = vi.fn(() => ({
  onConflictDoNothing: insertOnConflict,
  onConflictDoUpdate: insertOnConflictUpdate,
  returning: insertReturning,
}));
const insert = vi.fn(() => ({ values: insertValues }));
const execute = vi.fn();
const upsertAgentDevice = vi.fn();
const recordSuccessfulLocationOnDevice = vi.fn();
const listOpenTrackingAlerts = vi.fn();

const selectChain: Record<string, ReturnType<typeof vi.fn>> = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  leftJoin: vi.fn(),
  limit: vi.fn(),
};
selectChain.from.mockReturnValue(selectChain);
selectChain.where.mockReturnValue(selectChain);
selectChain.orderBy.mockReturnValue(selectChain);
selectChain.leftJoin.mockReturnValue(selectChain);
selectChain.limit.mockResolvedValue([{ trackingPolicyEnabled: true }]);

vi.mock("@propninja/db", () => ({
  agentLocations: {
    id: "id",
    userId: "user_id",
    eventId: "event_id",
    deviceId: "device_id",
    latitude: "latitude",
    longitude: "longitude",
    accuracy: "accuracy",
    batteryLevel: "battery_level",
    networkStatus: "network_status",
    source: "source",
    speed: "speed",
    heading: "heading",
    altitude: "altitude",
    capturedAt: "captured_at",
  },
  agentDevices: {
    id: "id",
    userId: "user_id",
    deviceId: "device_id",
    isCurrent: "is_current",
    lastSeenAt: "last_seen_at",
    lastCallLogSyncAt: "last_call_log_sync_at",
    updatedAt: "updated_at",
  },
  agentCallLogs: {
    id: "id",
    eventId: "event_id",
    userId: "user_id",
    deviceId: "device_id",
    callLogId: "call_log_id",
    phoneNumber: "phone_number",
    callType: "call_type",
    callStartTime: "call_start_time",
    callEndTime: "call_end_time",
    durationSeconds: "duration_seconds",
  },
  trackingAuditLogs: {
    id: "id",
    adminId: "admin_id",
    action: "action",
    agentId: "agent_id",
  },
  trackingSettings: { orgId: "org_id" },
  users: {
    id: "id",
    name: "name",
    email: "email",
    orgId: "org_id",
    role: "role",
    isActive: "is_active",
    trackingPolicyEnabled: "tracking_policy_enabled",
  },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../lib/trackingConfig.js", async () => {
  const { isWithinTrackingHours } = await import("@propninja/types/tracking");
  const config = {
    enabled: true,
    timezone: "Asia/Kolkata",
    startTime: "09:30",
    endTime: "20:30",
    intervalMinutes: 30,
    retentionDays: 14,
    missingAlertMinutes: 75,
    heartbeatThresholdMinutes: 60,
    possibleUninstallMinutes: 180,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    scheduleLabel: "09:30–20:30 IST (Mon–Sun)",
    schedule: {
      startHour: 9,
      startMinute: 30,
      endHour: 20,
      endMinute: 30,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    },
  };
  return {
    getTrackingConfig: () => config,
    getTrackingConfigForOrg: async () => config,
    isTrackingCaptureAllowed: (capturedAt: Date = new Date(), cfg = config) =>
      cfg.enabled && isWithinTrackingHours(capturedAt, cfg.schedule),
  };
});

vi.mock("../services/deviceTrackingService.js", () => ({
  upsertAgentDevice: (...args: unknown[]) => upsertAgentDevice(...args),
  recordSuccessfulLocationOnDevice: (...args: unknown[]) =>
    recordSuccessfulLocationOnDevice(...args),
}));

vi.mock("../services/trackingAlertService.js", () => ({
  listOpenTrackingAlerts: (...args: unknown[]) => listOpenTrackingAlerts(...args),
}));

import { locationRoutes } from "./locationRoutes.js";

function appWithUser(role: "admin" | "manager" | "agent") {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", {
      id: "11111111-1111-1111-1111-111111111111",
      role,
      email: "u@test.com",
      name: "Test",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      isFirstLogin: false,
    });
    c.set("db", {
      insert,
      execute,
      select: () => selectChain,
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
    } as never);
    await next();
  });
  app.route("/api/locations", locationRoutes);
  return app;
}

const withinHoursPing = {
  eventId: "evt_test_001",
  latitude: 12.97,
  longitude: 77.59,
  accuracy: 20,
  capturedAt: "2026-08-20T05:00:00.000Z",
  deviceId: "dev-1",
  networkStatus: "online" as const,
  source: "mobile_background",
};

describe("locationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockResolvedValue([]);
    selectChain.limit.mockResolvedValue([{ trackingPolicyEnabled: true }]);
    selectChain.orderBy.mockResolvedValue([]);
    insertReturning.mockResolvedValue([{ id: "loc-1" }]);
    insertOnConflict.mockImplementation(() => ({ returning: insertReturning }));
    upsertAgentDevice.mockResolvedValue({
      healthStatus: "ACTIVE",
      deviceStatus: "ONLINE",
      lastHeartbeatAt: new Date(),
    });
    listOpenTrackingAlerts.mockResolvedValue([]);
  });

  it("GET /config returns schedule", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/config");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { startTime: string; retentionDays: number; enabled: boolean };
    };
    expect(json.ok).toBe(true);
    expect(json.data.startTime).toBe("09:30");
    expect(json.data.enabled).toBe(true);
  });

  it("rejects ping without eventId", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.97,
        longitude: 77.59,
        capturedAt: "2026-08-20T05:00:00.000Z",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts a ping during working hours", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withinHoursPing),
    });
    expect(res.status).toBe(201);
    expect(recordSuccessfulLocationOnDevice).toHaveBeenCalled();
  });

  it("rejects ping outside working hours", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...withinHoursPing,
        eventId: "evt_night",
        capturedAt: "2026-08-20T16:00:00.000Z",
      }),
    });
    expect(res.status).toBe(422);
  });

  it("upserts device via service", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "android-abc",
        platform: "android",
        locationPermissionStatus: "granted",
      }),
    });
    expect(res.status).toBe(200);
    expect(upsertAgentDevice).toHaveBeenCalled();
  });

  it("forbids live for agents", async () => {
    const app = appWithUser("agent");
    expect((await app.request("/api/locations/live")).status).toBe(403);
  });

  it("allows live for admins", async () => {
    execute.mockResolvedValue([
      {
        user_id: "11111111-1111-1111-1111-111111111111",
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 15,
        captured_at: new Date("2026-08-20T05:00:00.000Z"),
        battery_level: 67,
        network_status: "online",
        name: "Rahul",
        email: "r@test.com",
        location_permission_status: "granted",
        call_log_permission_status: "granted",
        device_platform: "android",
        app_version: "1.0.10",
        tracking_enabled: true,
        health_status: "ACTIVE",
        device_status: "ONLINE",
        last_seen_at: new Date("2026-08-20T05:01:00.000Z"),
        last_heartbeat_at: new Date("2026-08-20T05:01:00.000Z"),
        last_location_at: new Date("2026-08-20T05:00:00.000Z"),
        tracking_policy_enabled: true,
        is_stale: false,
      },
    ]);
    insert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
    const app = appWithUser("admin");
    const res = await app.request("/api/locations/live");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { agents: Array<{ name: string; locationLabel?: string }> };
    };
    expect(json.data.agents[0]?.name).toBe("Rahul");
    expect(json.data.agents[0]?.locationLabel).toBe("CURRENT_LOCATION");
  });

  it("lists alerts for admins", async () => {
    listOpenTrackingAlerts.mockResolvedValue([
      {
        id: "a1",
        agentId: "11111111-1111-1111-1111-111111111111",
        deviceId: "d1",
        alertType: "DEVICE_OFFLINE",
        severity: "WARNING",
        title: "Device offline",
        message: "offline",
        metadata: {},
        createdAt: new Date(),
        agentName: "Rahul",
        agentEmail: "r@test.com",
      },
    ]);
    const app = appWithUser("admin");
    const res = await app.request("/api/locations/alerts");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { alerts: unknown[] } };
    expect(json.data.alerts).toHaveLength(1);
  });
});
