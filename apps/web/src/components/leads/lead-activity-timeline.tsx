"use client";

import { EmptyState } from "@/components/common/empty-state";
import type { LeadActivity } from "@/hooks/use-leads";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@propninja/ui/lib/utils";
import {
  ArrowRightLeft,
  CalendarDays,
  Clock,
  MessageCircle,
  Phone,
  StickyNote,
} from "lucide-react";

function siteVisitActivityTitle(kind: string | undefined) {
  switch (kind) {
    case "visit_scheduled":
      return "Site visit scheduled";
    case "visit_updated":
      return "Site visit updated";
    case "visit_rescheduled":
      return "Site visit rescheduled";
    case "visit_cancelled":
      return "Site visit cancelled";
    case "visit_completed":
      return "Site visit completed";
    case "whatsapp_sent":
    case "whatsapp_prepared":
      return "WhatsApp message prepared";
    case "reminder_sent":
      return "Reminder sent";
    case "customer_confirmed":
      return "Customer confirmed";
    case "customer_reschedule_requested":
      return "Customer requested reschedule";
    default:
      return "Site visit";
  }
}

function activityMeta(activity: LeadActivity) {
  const meta = activity.metadata;

  if (activity.type === "site_visit") {
    const kind = typeof meta?.kind === "string" ? meta.kind : undefined;
    const date = meta?.visitDate ? String(meta.visitDate) : null;
    const time = meta?.visitTime ? String(meta.visitTime) : null;
    const body = [date, time].filter(Boolean).join(" · ") || undefined;
    return {
      icon:
        kind === "whatsapp_sent" || kind === "whatsapp_prepared" || kind === "reminder_sent"
          ? MessageCircle
          : CalendarDays,
      title: siteVisitActivityTitle(kind),
      body,
    };
  }

  if (activity.type === "note" && meta?.text) {
    return {
      icon: StickyNote,
      title: "Note added",
      body: String(meta.text),
    };
  }

  if (activity.type === "status_change") {
    if (meta?.kind === "assignment") {
      return { icon: ArrowRightLeft, title: "Lead reassigned", body: "Assignment updated" };
    }
    if (meta?.from && meta?.to) {
      return {
        icon: ArrowRightLeft,
        title: "Status changed",
        body: `${meta.from} → ${meta.to}`,
      };
    }
  }

  if (activity.type === "call") {
    const disposition = meta?.disposition ? ` (${meta.disposition})` : "";
    return {
      icon: Phone,
      title: `Call — ${meta?.status ?? "logged"}${disposition}`,
      body: meta?.notes ? String(meta.notes) : undefined,
    };
  }

  return {
    icon: Clock,
    title: activity.type.replace(/_/g, " "),
    body: undefined,
  };
}

type LeadActivityTimelineProps = {
  activities: LeadActivity[];
};

export function LeadActivityTimeline({ activities }: LeadActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Calls, notes, and status changes will appear here as your team works this lead."
        icon={<Clock className="h-7 w-7" />}
      />
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-2 left-[18px] top-2 w-px bg-border" />
      {activities.map((activity, index) => {
        const { icon: Icon, title, body } = activityMeta(activity);
        return (
          <div key={activity.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card shadow-[2px_2px_0_0_#000]",
                activity.type === "call" && "border-emerald-500/30 text-emerald-600",
                activity.type === "note" && "border-indigo-500/30 text-indigo-600",
                activity.type === "status_change" && "border-amber-500/30 text-amber-600",
                activity.type === "site_visit" && "border-sky-500/30 text-sky-600",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 rounded-lg border border-slate-200/80 bg-muted/20 p-3 transition-all duration-200 hover:shadow-sm dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold">{title}</p>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(activity.createdAt)}
                </span>
              </div>
              {activity.userName ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{activity.userName}</p>
              ) : null}
              {body ? <p className="mt-2 text-sm text-foreground/90">{body}</p> : null}
              {index === 0 ? (
                <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wide text-primary">
                  Latest
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
