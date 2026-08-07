import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiPost } from "./apiClient";
import {
  ALERTS_PUSH_CHANNEL_ID,
  FOLLOWUPS_PUSH_CHANNEL_ID,
  NOTIFICATION_SOUND_FILE,
} from "./notificationSound";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PermStatus = { granted: boolean; canAskAgain: boolean };

function getExpoProjectId(): string | undefined {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof projectId === "string" && projectId.length > 0 ? projectId : undefined;
}

export async function registerPushToken(): Promise<void> {
  try {
    const existing = (await Notifications.getPermissionsAsync()) as unknown as PermStatus;
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const result = (await Notifications.requestPermissionsAsync()) as unknown as PermStatus;
      granted = result.granted;
    }

    if (!granted) return;

    const projectId = getExpoProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;

    await apiPost("/api/auth/push-token", { token }, { skipSessionLogout: true });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(ALERTS_PUSH_CHANNEL_ID, {
        name: "CRM alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 120, 250],
        lightColor: "#204060",
        sound: NOTIFICATION_SOUND_FILE,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(FOLLOWUPS_PUSH_CHANNEL_ID, {
        name: "Follow-up reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300, 150, 300],
        lightColor: "#204060",
        sound: NOTIFICATION_SOUND_FILE,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#14b8a6",
        sound: NOTIFICATION_SOUND_FILE,
      });
    }
  } catch {
    // Push registration is best-effort — never block the app
  }
}

export function addNotificationResponseListener(
  handler: (notification: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export async function setBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // ignore
  }
}
