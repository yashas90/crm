"use client";

import { Badge } from "@/components/ui/badge";
import {
  type NotificationRow,
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function leadIdFromPayload(payload: Record<string, unknown>): string | null {
  const id = payload.leadId;
  return typeof id === "string" ? id : null;
}

function formatNotificationLabel(notification: NotificationRow): string {
  const payload = notification.payload;
  const leadName = typeof payload.leadName === "string" ? payload.leadName : "Lead";

  if (notification.type === "lead_assigned") {
    const assignedBy = typeof payload.assignedBy === "string" ? payload.assignedBy : "Someone";
    return `${assignedBy} assigned you ${leadName}`;
  }

  if (notification.type === "followup_due") {
    return `Follow-up due for ${leadName}`;
  }

  return leadName;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationsRead();

  const items = notificationsQuery.data?.items.slice(0, 10) ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleNotificationClick(notification: NotificationRow) {
    if (!notification.isRead) {
      await markRead.mutateAsync([notification.id]);
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
            <p className="font-heading text-sm font-bold uppercase">Notifications</p>
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notificationsQuery.isLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((notification) => {
                  const leadId = leadIdFromPayload(notification.payload);
                  const content = (
                    <div
                      className={cn(
                        "block px-4 py-3 text-left transition-colors hover:bg-muted/50",
                        !notification.isRead && "bg-primary/5",
                      )}
                    >
                      <p className="text-sm font-medium">{formatNotificationLabel(notification)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  );

                  return (
                    <li key={notification.id}>
                      {leadId ? (
                        <Link
                          href={`/leads/${leadId}`}
                          onClick={() => void handleNotificationClick(notification)}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="w-full"
                          onClick={() => void handleNotificationClick(notification)}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Deferred: email / SMS / web-push delivery (in-app only in v1.0) */}
        </div>
      ) : null}
    </div>
  );
}
