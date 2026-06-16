import { describe, expect, it, vi } from "vitest";
import { NOTIFICATION_TYPES, createNotificationService } from "./notificationService.js";

describe("createNotificationService", () => {
  it("creates a notification row", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-0000000000aa",
        userId: "00000000-0000-0000-0000-000000000001",
        type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
        payload: { leadId: "lead-1" },
        isRead: false,
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
      },
    ]);

    const db = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning }) }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ expoPushToken: null }]),
          }),
        }),
      }),
    };

    const service = createNotificationService(db as never);
    const row = await service.createNotification(
      "00000000-0000-0000-0000-000000000001",
      NOTIFICATION_TYPES.LEAD_ASSIGNED,
      { leadId: "lead-1" },
    );

    expect(row?.type).toBe("lead_assigned");
    expect(row?.payload).toEqual({ leadId: "lead-1" });
  });

  it("marks notifications as read for the current user only", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "n-1" }, { id: "n-2" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    const db = { update };
    const service = createNotificationService(db as never);
    const marked = await service.markAsRead("user-1", ["n-1", "n-2"]);

    expect(marked).toBe(2);
    expect(update).toHaveBeenCalledOnce();
  });
});
