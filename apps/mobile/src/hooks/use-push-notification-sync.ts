import { queryClient } from "@/lib/queryClient";
import {
  LEAD_ALERT_NOTIFICATION_TYPES,
  playLeadAlertSound,
} from "@/lib/notificationSound";
import { NOTIFICATIONS_QUERY_KEY } from "@/lib/queryKeys";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

/**
 * Invalidate notification queries when a push arrives — replaces polling
 * for unread counts while the app is open.
 */
export function usePushNotificationSync() {
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      const data = notification.request.content.data as Record<string, unknown>;
      const type = typeof data?.type === "string" ? data.type : "";
      if (LEAD_ALERT_NOTIFICATION_TYPES.has(type)) {
        void playLeadAlertSound();
      }

      const badge = notification.request.content.badge;
      if (typeof badge === "number") {
        void Notifications.setBadgeCountAsync(badge);
      }
    });

    return () => sub.remove();
  }, []);
}
