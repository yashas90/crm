import {
  FOLLOWUP_REMINDER_LEAD_MINUTES,
  cancelFollowUpReminder,
  scheduleFollowUpReminder,
} from "@/lib/followUpLocalReminders";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationChannelAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

describe("followUpLocalReminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schedules reminder five minutes before due time", async () => {
    const Notifications = require("expo-notifications");
    const due = new Date(Date.now() + 30 * 60_000).toISOString();
    await scheduleFollowUpReminder({
      leadId: "lead-1",
      leadName: "Test Lead",
      nextFollowupAt: due,
    });

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "followup-reminder:lead-1",
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "followup-reminder:lead-1",
        content: expect.objectContaining({
          title: "Follow-up in 5 minutes",
          body: "Test Lead",
          sound: "notification_swish.mp3",
        }),
        trigger: expect.objectContaining({
          type: "date",
          channelId: "followups_swish",
        }),
      }),
    );

    const triggerDate = Notifications.scheduleNotificationAsync.mock.calls[0][0].trigger
      .date as Date;
    const expected = new Date(due).getTime() - FOLLOWUP_REMINDER_LEAD_MINUTES * 60_000;
    expect(Math.abs(triggerDate.getTime() - expected)).toBeLessThan(2000);
  });

  it("cancels without scheduling when follow-up is cleared", async () => {
    const Notifications = require("expo-notifications");
    await scheduleFollowUpReminder({
      leadId: "lead-1",
      leadName: "Test Lead",
      nextFollowupAt: null,
    });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancelFollowUpReminder cancels by id", async () => {
    const Notifications = require("expo-notifications");
    await cancelFollowUpReminder("lead-9");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "followup-reminder:lead-9",
    );
  });
});
