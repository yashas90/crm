"use client";

import { useNotifications } from "@/hooks/use-notifications";
import { LEAD_ALERT_NOTIFICATION_TYPES, playNotificationSound } from "@/lib/notification-sound";
import { useEffect, useRef } from "react";

/** Plays a chime when new lead-assignment or Meta lead notifications arrive. */
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
        playNotificationSound();
        break;
      }
    }

    for (const item of items) {
      seenIdsRef.current.add(item.id);
    }
  }, [data]);
}
