import { useNotifications } from "@/hooks/use-notifications";
import { playNotificationSound } from "@/lib/notificationSound";
import { useEffect, useRef } from "react";

/** Plays chime when any unread notification appears via API polling (app foreground). */
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
      if (!seenIdsRef.current.has(item.id) && !item.isRead) {
        void playNotificationSound();
        break;
      }
    }

    for (const item of items) {
      seenIdsRef.current.add(item.id);
    }
  }, [data]);
}
