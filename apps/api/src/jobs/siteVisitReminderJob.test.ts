import { beforeEach, describe, expect, it, vi } from "vitest";

const { findDueForReminder, markReminderSent, createNotification } = vi.hoisted(() => ({
  findDueForReminder: vi.fn(),
  markReminderSent: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("../services/siteVisitService.js", () => ({
  siteVisitService: {
    findDueForReminder,
    markReminderSent,
  },
}));

vi.mock("../lib/db.js", () => ({
  getDb: () => ({}),
}));

vi.mock("../services/notificationService.js", () => ({
  NOTIFICATION_TYPES: { SITE_VISIT_REMINDER: "site_visit_reminder" },
  createNotificationService: () => ({
    createNotification,
  }),
}));

import { syncSiteVisitReminders } from "./siteVisitReminderJob.js";

describe("syncSiteVisitReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createNotification.mockResolvedValue({ id: "n1" });
    markReminderSent.mockResolvedValue(undefined);
  });

  it("sends reminders for due visits and marks reminder_sent", async () => {
    findDueForReminder.mockResolvedValue([
      {
        id: "visit-1",
        agentId: "agent-1",
        leadId: "lead-1",
        visitDate: "2026-06-16",
        visitTime: "14:30:00",
        duration: 60,
        propertyLabel: "Sunrise Apartments",
        propertyAddress: null,
        lead: { id: "lead-1", firstName: "Ravi", lastName: "Kumar", phone: "+911234567890" },
      },
    ]);

    const result = await syncSiteVisitReminders(new Date("2026-06-16T14:00:00"));

    expect(result.sent).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      "agent-1",
      "site_visit_reminder",
      expect.objectContaining({
        siteVisitId: "visit-1",
        leadName: "Ravi Kumar",
        property: "Sunrise Apartments",
      }),
    );
    expect(markReminderSent).toHaveBeenCalledWith("visit-1");
  });

  it("returns zero when no visits are due", async () => {
    findDueForReminder.mockResolvedValue([]);
    const result = await syncSiteVisitReminders();
    expect(result).toEqual({ sent: 0, checked: 0 });
    expect(createNotification).not.toHaveBeenCalled();
  });
});
