import { useNotifications } from "@/hooks/use-notifications";
import { LEAD_ALERT_NOTIFICATION_TYPES, playLeadAlertSound } from "@/lib/notificationSound";
import { useEffect, useRef } from "react";

/** Plays chime when lead alerts appear via API polling (app foreground, no push). */
export function useNotificationSound() {
  const { data } = useNotifications();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const items = data?.items;
    if (!items) return;

    if (!bootstrappedRef.current) {
      for (const item of items) {
        seenIdsRef.current.add(item.id);
      }
      bootstrappedRef.current = true;
      return;
    }

    for (const item of items) {
      if (
        !seenIdsRef.current.has(item.id) &&
        !item.isRead &&
        LEAD_ALERT_NOTIFICATION_TYPES.has(item.type)
      ) {
        void playLeadAlertSound();
        break;
      }
    }

    for (const item of items) {
      seenIdsRef.current.add(item.id);
    }
  }, [data]);
}
