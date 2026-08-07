import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { FOLLOWUPS_PUSH_CHANNEL_ID, NOTIFICATION_SOUND_FILE } from "./notificationSound";

export const FOLLOWUP_REMINDER_LEAD_MINUTES = 5;
export const FOLLOWUP_CHANNEL_ID = FOLLOWUPS_PUSH_CHANNEL_ID;

function reminderId(leadId: string) {
  return `followup-reminder:${leadId}`;
}

export async function ensureFollowUpNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(FOLLOWUP_CHANNEL_ID, {
    name: "Follow-up reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 150, 300, 150, 300],
    lightColor: "#204060",
    sound: NOTIFICATION_SOUND_FILE,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Cancel a previously scheduled T-5 local reminder for this lead. */
export async function cancelFollowUpReminder(leadId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId(leadId));
  } catch {
    // already cancelled / never scheduled
  }
}

/**
 * Schedule a local ringtone notification 5 minutes before the follow-up.
 * No-ops if the reminder time is already in the past.
 */
export async function scheduleFollowUpReminder(input: {
  leadId: string;
  leadName: string;
  nextFollowupAt: string | null | undefined;
}) {
  const { leadId, leadName, nextFollowupAt } = input;
  await cancelFollowUpReminder(leadId);

  if (!nextFollowupAt) return;

  const dueAt = new Date(nextFollowupAt).getTime();
  if (!Number.isFinite(dueAt)) return;

  const reminderAt = dueAt - FOLLOWUP_REMINDER_LEAD_MINUTES * 60_000;
  if (reminderAt <= Date.now() + 5_000) return;

  await ensureFollowUpNotificationChannel();

  await Notifications.scheduleNotificationAsync({
    identifier: reminderId(leadId),
    content: {
      title: "Follow-up in 5 minutes",
      body: leadName.trim() || "Lead follow-up",
      sound: NOTIFICATION_SOUND_FILE,
      data: {
        type: "followup_reminder",
        leadId,
        nextFollowupAt,
      },
      ...(Platform.OS === "android" ? { channelId: FOLLOWUP_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminderAt),
      channelId: Platform.OS === "android" ? FOLLOWUP_CHANNEL_ID : undefined,
    },
  });
}

/** Replace all local follow-up schedules with the given upcoming list. */
export async function syncFollowUpReminders(
  items: Array<{ id: string; leadName: string; nextFollowupAt: string | null }>,
) {
  await ensureFollowUpNotificationChannel();

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const note of existing) {
    if (note.identifier.startsWith("followup-reminder:")) {
      await Notifications.cancelScheduledNotificationAsync(note.identifier);
    }
  }

  const now = Date.now();
  for (const item of items) {
    if (!item.nextFollowupAt) continue;
    const due = new Date(item.nextFollowupAt).getTime();
    if (!Number.isFinite(due) || due <= now) continue;
    await scheduleFollowUpReminder({
      leadId: item.id,
      leadName: item.leadName,
      nextFollowupAt: item.nextFollowupAt,
    });
  }
}
