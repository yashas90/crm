import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { setBadgeCount } from "@/lib/pushNotifications";
import { useEffect } from "react";

/** Sync app icon badge with unread notification count. */
export function useAppIconBadge() {
  const unreadCount = useUnreadNotificationCount();

  useEffect(() => {
    void setBadgeCount(unreadCount);
  }, [unreadCount]);
}
