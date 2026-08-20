import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteReturning = vi.fn();
const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
const del = vi.fn(() => ({ where: deleteWhere }));
const insertReturning = vi.fn();
const insertValues = vi.fn(() => ({ returning: insertReturning }));
const insert = vi.fn(() => ({ values: insertValues }));
const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
const update = vi.fn(() => ({ set: updateSet }));

vi.mock("@propninja/db", () => ({
  agentLocations: { id: "id", capturedAt: "captured_at" },
  agentCallLogs: { id: "id", callStartTime: "call_start_time" },
  trackingCleanupRuns: { id: "id" },
  users: { id: "id", orgId: "org_id", role: "role", isActive: "is_active" },
}));

vi.mock("./db.js", () => ({
  db: { delete: del, insert, update },
}));

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("./trackingConfig.js", () => ({
  getTrackingConfig: () => ({ retentionDays: 14 }),
}));

vi.mock("../services/trackingAlertService.js", () => ({
  upsertOpenTrackingAlert: vi.fn(),
}));

describe("purgeExpiredTrackingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteReturning.mockResolvedValue([]);
    insertReturning.mockResolvedValue([{ id: "run-1" }]);
  });

  it("deletes locations and call logs older than retention", async () => {
    deleteReturning
      .mockResolvedValueOnce([{ id: "old-loc" }, { id: "old-loc-2" }])
      .mockResolvedValueOnce([{ id: "old-call" }]);

    const { purgeExpiredTrackingData } = await import("./purgeExpiredTracking.js");
    const result = await purgeExpiredTrackingData({
      delete: del,
      insert,
      update,
    } as never);

    expect(result.locationsDeleted).toBe(2);
    expect(result.callLogsDeleted).toBe(1);
    expect(result.retentionDays).toBe(14);
    expect(result.status).toBe("completed");
    expect(del).toHaveBeenCalledTimes(2);
  });

  it("is safe when nothing is expired", async () => {
    deleteReturning.mockResolvedValue([]);
    const { purgeExpiredTrackingData } = await import("./purgeExpiredTracking.js");
    const result = await purgeExpiredTrackingData({
      delete: del,
      insert,
      update,
    } as never);
    expect(result.locationsDeleted).toBe(0);
    expect(result.callLogsDeleted).toBe(0);
  });
});
