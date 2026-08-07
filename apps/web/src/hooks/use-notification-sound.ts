"use client";

import { useNotifications } from "@/hooks/use-notifications";
import { LEAD_ALERT_NOTIFICATION_TYPES, playNotificationSound } from "@/lib/notification-sound";
import { useEffect, useRef } from "react";

function browserToastTitle(type: string): string {
  switch (type) {
    case "callback_requested":
      return "Callback requested";
    case "site_visit_confirmed_by_client":
      return "Visit confirmed";
    case "new_ad_lead":
      return "New Meta lead";
    case "lead_assigned":
    case "leads_bulk_assigned":
      return "New lead assigned";
    case "sla_breach":
      return "SLA breach";
    default:
      return "PropNinja notification";
  }
}

function browserToastBody(type: string, payload: Record<string, unknown>): string {
  const leadName = typeof payload.leadName === "string" ? payload.leadName : "Lead";
  const campaignName = typeof payload.campaignName === "string" ? payload.campaignName : null;
  if (type === "new_ad_lead") {
    return `${leadName} · ${campaignName ?? "Meta Ads"}`;
  }
  if (type === "callback_requested") {
    return `${leadName} asked for a callback`;
  }
  return leadName;
}

/** Plays the swish sound for any new unread notification (agents & admins). */
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
        playNotificationSound();
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          LEAD_ALERT_NOTIFICATION_TYPES.has(item.type)
        ) {
          if (Notification.permission === "granted") {
            const payload = (item.payload ?? {}) as Record<string, unknown>;
            new Notification(browserToastTitle(item.type), {
              body: browserToastBody(item.type, payload),
              tag: item.id,
            });
          } else if (Notification.permission === "default") {
            void Notification.requestPermission();
          }
        }
        break;
      }
    }

    for (const item of items) {
      seenIdsRef.current.add(item.id);
    }
  }, [data]);
}
