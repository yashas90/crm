import { playNotificationSound } from "@/lib/notificationSound";
import { queryClient } from "@/lib/queryClient";
import { NOTIFICATIONS_QUERY_KEY } from "@/lib/queryKeys";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

/**
 * Invalidate notification queries when a push arrives — replaces polling
 * for unread counts while the app is open. Plays sound for every push.
 */
export function usePushNotificationSync() {
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      void playNotificationSound();

      const badge = notification.request.content.badge;
      if (typeof badge === "number") {
        void Notifications.setBadgeCountAsync(badge);
      }
    });

    return () => sub.remove();
  }, []);
}
