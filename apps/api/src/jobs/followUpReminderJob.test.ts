import { describe, expect, it, vi } from "vitest";

const createNotification = vi.fn().mockResolvedValue({ id: "n-1" });
const hasFollowupNotification = vi.fn().mockResolvedValue(false);

vi.mock("../services/notificationService.js", () => ({
  NOTIFICATION_TYPES: { FOLLOWUP_REMINDER: "followup_reminder" },
  createNotificationService: () => ({
    hasFollowupNotification,
    createNotification,
  }),
}));

vi.mock("../lib/db.js", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [
          {
            id: "lead-1",
            firstName: "Raj",
            lastName: "Kumar",
            assignedTo: "agent-1",
            nextFollowupAt: new Date(Date.now() + 3 * 60_000),
          },
        ],
      }),
    }),
  }),
}));

describe("syncFollowupReminders", () => {
  it("creates reminders for follow-ups in the next 5 minutes", async () => {
    const { syncFollowupReminders } = await import("../jobs/followUpReminderJob.js");
    const result = await syncFollowupReminders();
    expect(result.checked).toBe(1);
    expect(result.created).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      "agent-1",
      "followup_reminder",
      expect.objectContaining({ leadId: "lead-1" }),
    );
  });
});
