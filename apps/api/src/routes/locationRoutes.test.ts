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

const selectChain: Record<string, ReturnType<typeof vi.fn>> = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
};
selectChain.from.mockReturnValue(selectChain);
selectChain.where.mockReturnValue(selectChain);
selectChain.orderBy.mockResolvedValue([]);

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
    platform: "platform",
    appVersion: "app_version",
    locationPermissionStatus: "location_permission_status",
    callLogPermissionStatus: "call_log_permission_status",
    trackingEnabled: "tracking_enabled",
    batteryLevel: "battery_level",
    networkStatus: "network_status",
    lastSeenAt: "last_seen_at",
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
    ipAddress: "ip_address",
    userAgent: "user_agent",
  },
  users: { id: "id", name: "name", email: "email" },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../lib/trackingConfig.js", async () => {
  const { isWithinTrackingHours } = await import("@propninja/types/tracking");
  return {
    getTrackingConfig: () => ({
      timezone: "Asia/Kolkata",
      startTime: "09:30",
      endTime: "20:30",
      intervalMinutes: 30,
      retentionDays: 14,
      missingAlertMinutes: 75,
      scheduleLabel: "09:30–20:30 IST (Mon–Sun)",
      schedule: {
        startHour: 9,
        startMinute: 30,
        endHour: 20,
        endMinute: 30,
      },
    }),
    isTrackingCaptureAllowed: (capturedAt: Date = new Date()) => isWithinTrackingHours(capturedAt),
  };
});

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
  capturedAt: "2026-08-20T05:00:00.000Z", // 10:30 IST
  deviceId: "dev-1",
  networkStatus: "online" as const,
  source: "mobile_background",
};

describe("locationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockResolvedValue([]);
    selectChain.orderBy.mockResolvedValue([]);
    insertReturning.mockResolvedValue([{ id: "loc-1" }]);
    insertValues.mockImplementation(() => ({
      onConflictDoNothing: insertOnConflict,
      onConflictDoUpdate: insertOnConflictUpdate,
      returning: insertReturning,
    }));
    insertOnConflict.mockImplementation(() => ({ returning: insertReturning }));
    insert.mockImplementation(() => ({ values: insertValues }));
  });

  it("GET /config returns schedule", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/config");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { startTime: string; retentionDays: number };
    };
    expect(json.ok).toBe(true);
    expect(json.data.startTime).toBe("09:30");
    expect(json.data.retentionDays).toBe(14);
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

  it("accepts a ping from any authenticated user during working hours", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withinHoursPing),
    });
    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalled();
  });

  it("rejects ping outside working hours", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...withinHoursPing,
        eventId: "evt_night",
        capturedAt: "2026-08-20T16:00:00.000Z", // 21:30 IST
      }),
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(json.error.code).toBe("OUTSIDE_TRACKING_HOURS");
  });

  it("accepts bulk pings", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          withinHoursPing,
          { ...withinHoursPing, eventId: "evt_test_002", capturedAt: "2026-08-20T05:30:00.000Z" },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      ok: boolean;
      data: { inserted: number };
    };
    expect(json.data.inserted).toBe(2);
  });

  it("upserts device status", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "android-abc",
        platform: "android",
        appVersion: "1.0.10",
        locationPermissionStatus: "granted",
        callLogPermissionStatus: "granted",
        trackingEnabled: true,
        networkStatus: "online",
      }),
    });
    expect(res.status).toBe(200);
    expect(insertOnConflictUpdate).toHaveBeenCalled();
  });

  it("bulk call-logs is idempotent via empty returning", async () => {
    insertReturning.mockResolvedValueOnce([{ id: "c1" }]).mockResolvedValueOnce([]);
    const app = appWithUser("agent");
    const payload = {
      items: [
        {
          eventId: "call_evt_1",
          deviceId: "dev-1",
          callLogId: "os-1",
          phoneNumber: "9876543210",
          callType: "OUTGOING",
          callStartTime: "2026-08-20T05:10:00.000Z",
          durationSeconds: 40,
        },
      ],
    };
    const first = await app.request("/api/locations/call-logs/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    expect(((await first.json()) as { data: { inserted: number } }).data.inserted).toBe(1);

    const second = await app.request("/api/locations/call-logs/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(((await second.json()) as { data: { duplicates: number } }).data.duplicates).toBe(1);
  });

  it("forbids live locations for agents", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/live");
    expect(res.status).toBe(403);
  });

  it("forbids live locations for managers", async () => {
    const app = appWithUser("manager");
    const res = await app.request("/api/locations/live");
    expect(res.status).toBe(403);
  });

  it("allows live locations for admins with status fields", async () => {
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
      },
    ]);
    insertValues.mockImplementation(() => ({
      onConflictDoNothing: insertOnConflict,
      onConflictDoUpdate: insertOnConflictUpdate,
      returning: insertReturning,
    }));
    // audit insert has no returning chain in route — values() resolves
    insert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));

    const app = appWithUser("admin");
    const res = await app.request("/api/locations/live");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: {
        agents: Array<{
          name: string;
          batteryLevel: number | null;
          locationPermissionStatus: string | null;
        }>;
      };
    };
    expect(json.ok).toBe(true);
    expect(json.data.agents).toHaveLength(1);
    expect(json.data.agents[0]?.name).toBe("Rahul");
    expect(json.data.agents[0]?.batteryLevel).toBe(67);
    expect(json.data.agents[0]?.locationPermissionStatus).toBe("granted");
  });

  it("history returns gaps for missing intervals", async () => {
    const t1 = new Date("2026-08-20T04:00:00.000Z");
    const t2 = new Date("2026-08-20T06:00:00.000Z");
    selectChain.orderBy.mockResolvedValue([
      {
        id: "1",
        latitude: 12.9,
        longitude: 77.5,
        accuracy: 10,
        capturedAt: t1,
        batteryLevel: 50,
        networkStatus: "online",
      },
      {
        id: "2",
        latitude: 12.91,
        longitude: 77.51,
        accuracy: 12,
        capturedAt: t2,
        batteryLevel: 48,
        networkStatus: "online",
      },
    ]);
    insert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));

    const app = appWithUser("admin");
    const res = await app.request(
      "/api/locations/history?userId=11111111-1111-1111-1111-111111111111&date=2026-08-20",
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { items: unknown[]; gaps: Array<{ minutes: number }> };
    };
    expect(json.data.items).toHaveLength(2);
    expect(json.data.gaps.length).toBeGreaterThanOrEqual(1);
    expect(json.data.gaps[0]?.minutes).toBeGreaterThan(30);
  });
});
