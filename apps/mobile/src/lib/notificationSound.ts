import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";

/** @deprecated Prefer playing sound for every notification type. */
export const LEAD_ALERT_NOTIFICATION_TYPES = new Set([
  "lead_assigned",
  "leads_bulk_assigned",
  "new_ad_lead",
  "sla_breach",
  "task_assigned",
  "task_due",
  "followup_due",
  "site_visit_scheduled",
  "site_visit_reminder",
]);

let cachedSound: Audio.Sound | null = null;
let lastPlayedAt = 0;

/** Plays the in-app chime for any notification (foreground push or polled inbox). */
export async function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;
  if (Platform.OS === "android") {
    Vibration.vibrate([0, 120, 60, 120]);
  }

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // simulators may not support haptics
  }

  try {
    if (!cachedSound) {
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/notification-chime.wav"),
        { volume: 0.85, shouldPlay: false },
      );
      cachedSound = sound;
    }

    await cachedSound.setPositionAsync(0);
    await cachedSound.playAsync();
  } catch {
    // audio unavailable — haptics/vibration still fired
  }
}

/** @deprecated Use playNotificationSound */
export const playLeadAlertSound = playNotificationSound;
