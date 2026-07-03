import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findDueForReminders,
  markReminderTierSent,
  createNotification,
  runSiteVisitAutomation,
  markMissedSiteVisits,
} = vi.hoisted(() => ({
  findDueForReminders: vi.fn(),
  markReminderTierSent: vi.fn(),
  createNotification: vi.fn(),
  runSiteVisitAutomation: vi.fn(),
  markMissedSiteVisits: vi.fn(),
}));

vi.mock("../services/siteVisitService.js", () => ({
  siteVisitService: {
    findDueForReminders,
    markReminderTierSent,
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

vi.mock("../services/siteVisitAutomationService.js", () => ({
  runSiteVisitAutomation,
  markMissedSiteVisits,
}));

import { syncSiteVisitReminders } from "./siteVisitReminderJob.js";

describe("syncSiteVisitReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createNotification.mockResolvedValue({ id: "n1" });
    markReminderTierSent.mockResolvedValue(undefined);
    runSiteVisitAutomation.mockResolvedValue(undefined);
    markMissedSiteVisits.mockResolvedValue(0);
  });

  it("sends tier reminders and marks tier sent", async () => {
    findDueForReminders.mockResolvedValue([
      {
        id: "visit-1",
        agentId: "agent-1",
        leadId: "lead-1",
        visitDate: "2026-06-16",
        visitTime: "14:30:00",
        duration: 60,
        tierMinutes: 30,
        propertyLabel: "Sunrise Apartments",
        propertyAddress: null,
        lead: { id: "lead-1", firstName: "Ravi", lastName: "Kumar", phone: "+911234567890" },
      },
    ]);

    const result = await syncSiteVisitReminders(new Date("2026-06-16T14:00:00"));

    expect(result.sent).toBe(1);
    expect(runSiteVisitAutomation).toHaveBeenCalledWith("visit-1", "reminder", expect.any(Object));
    expect(markReminderTierSent).toHaveBeenCalledWith("visit-1", 30);
  });

  it("returns zero when no visits are due", async () => {
    findDueForReminders.mockResolvedValue([]);
    const result = await syncSiteVisitReminders();
    expect(result).toEqual({ sent: 0, checked: 0, missed: 0 });
    expect(createNotification).not.toHaveBeenCalled();
  });
});
