import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendPushNotificationsAsync, isExpoPushToken } = vi.hoisted(() => ({
  sendPushNotificationsAsync: vi.fn(),
  isExpoPushToken: vi.fn(),
}));

vi.mock("expo-server-sdk", () => ({
  Expo: class MockExpo {
    static isExpoPushToken(token: string) {
      return isExpoPushToken(token);
    }

    sendPushNotificationsAsync = sendPushNotificationsAsync;
  },
}));

import { clearPushToken, sendPushNotification } from "./pushNotifications.js";

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isExpoPushToken.mockReturnValue(true);
  });

  function mockDb(token: string | null) {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    const selectLimit = vi
      .fn()
      .mockResolvedValue(token ? [{ expoPushToken: token }] : [{ expoPushToken: null }]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const from = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from });

    return { db: { select, update } as never, update, where };
  }

  it("returns no_token when user has no expo push token", async () => {
    const { db } = mockDb(null);

    const result = await sendPushNotification(db, "user-1", "Title", "Body");

    expect(result).toEqual({ sent: false, reason: "no_token" });
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it("sends a push notification when token is valid", async () => {
    const { db } = mockDb("ExponentPushToken[abc123]");
    sendPushNotificationsAsync.mockResolvedValue([{ status: "ok", id: "ticket-1" }]);

    const result = await sendPushNotification(db, "user-1", "Lead assigned", "New lead for you", {
      leadId: "lead-1",
      type: "lead_assigned",
    });

    expect(result).toEqual({ sent: true });
    expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
      expect.objectContaining({
        to: "ExponentPushToken[abc123]",
        title: "Lead assigned",
        body: "New lead for you",
        data: { leadId: "lead-1", type: "lead_assigned" },
      }),
    ]);
  });

  it("clears token when Expo returns DeviceNotRegistered", async () => {
    const { db, update, where } = mockDb("ExponentPushToken[stale]");
    sendPushNotificationsAsync.mockResolvedValue([
      {
        status: "error",
        message: "Device not registered",
        details: { error: "DeviceNotRegistered" },
      },
    ]);

    const result = await sendPushNotification(db, "user-1", "Title", "Body");

    expect(result).toEqual({ sent: false, reason: "ticket_error" });
    expect(update).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it("clears invalid token format without calling Expo", async () => {
    const { db, update } = mockDb("not-a-valid-token");
    isExpoPushToken.mockReturnValue(false);

    const result = await sendPushNotification(db, "user-1", "Title", "Body");

    expect(result).toEqual({ sent: false, reason: "invalid_token" });
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });
});

describe("clearPushToken", () => {
  it("nulls expo_push_token for the user", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const db = { update } as never;

    await clearPushToken(db, "user-1");

    expect(set).toHaveBeenCalledWith({ expoPushToken: null });
    expect(where).toHaveBeenCalled();
  });
});
