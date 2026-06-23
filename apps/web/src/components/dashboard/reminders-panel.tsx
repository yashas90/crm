"use client";

import { NeuButton, NeuCard, NeuStickyNote } from "@/components/ui/neubrutal";
import type { FollowupReminderType, UpcomingFollowup } from "@/hooks/use-upcoming-followups";
import { useUpcomingFollowups } from "@/hooks/use-upcoming-followups";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { BellRing, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const TYPE_LABELS: Record<FollowupReminderType, string> = {
  callback: "Callback",
  meeting: "Meeting",
  site_visit: "Site visit",
};

function toLocalDateKey(iso: string) {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayKey = toLocalDateKey(today.toISOString());
  const tomorrowKey = toLocalDateKey(tomorrow.toISOString());

  if (dateKey === todayKey) return "Today";
  if (dateKey === tomorrowKey) return "Tomorrow";

  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function dueLabel(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Due soon";
  if (hours < 24) return `Due in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Due in ${days}d`;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days: Array<{ dateKey: string | null; day: number | null }> = [];

  for (let i = 0; i < startPad; i += 1) {
    days.push({ dateKey: null, day: null });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ dateKey, day });
  }

  return days;
}

function groupByDate(items: UpcomingFollowup[]) {
  const map = new Map<string, UpcomingFollowup[]>();
  for (const item of items) {
    const key = toLocalDateKey(item.nextFollowupAt);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function summarizeDay(items: UpcomingFollowup[]) {
  const counts = { callback: 0, meeting: 0, site_visit: 0 };
  for (const item of items) {
    counts[item.type] += 1;
  }
  return counts;
}

function summaryText(counts: { callback: number; meeting: number; site_visit: number }) {
  const parts: string[] = [];
  if (counts.callback > 0)
    parts.push(`${counts.callback} callback${counts.callback === 1 ? "" : "s"}`);
  if (counts.meeting > 0) parts.push(`${counts.meeting} meeting${counts.meeting === 1 ? "" : "s"}`);
  if (counts.site_visit > 0) {
    parts.push(`${counts.site_visit} site visit${counts.site_visit === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(", ") : "No reminders";
}

type RemindersPanelProps = {
  collapsible?: boolean;
  className?: string;
  variant?: "default" | "neubrutal";
};

export function RemindersPanel({
  collapsible = false,
  className,
  variant = "default",
}: RemindersPanelProps) {
  const followups = useUpcomingFollowups(14);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!collapsible);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const now = new Date();
  const monthLabel = now.toLocaleDateString([], { month: "long", year: "numeric" });
  const monthGrid = useMemo(
    () => buildMonthGrid(now.getFullYear(), now.getMonth()),
    [now.getFullYear(), now.getMonth()],
  );

  const byDate = useMemo(() => groupByDate(followups.data ?? []), [followups.data]);
  const sortedDates = useMemo(
    () => [...byDate.keys()].sort((a, b) => a.localeCompare(b)),
    [byDate],
  );

  const upcomingItems = useMemo(() => {
    const items = followups.data ?? [];
    return [...items].sort((a, b) => a.nextFollowupAt.localeCompare(b.nextFollowupAt)).slice(0, 5);
  }, [followups.data]);

  const todayKey = toLocalDateKey(now.toISOString());

  const calendarContent = (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{monthLabel}</p>
          <span className="text-xs text-muted-foreground">Next 14 days</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthGrid.map((cell, index) => {
            if (!cell.dateKey || cell.day === null) {
              return <span key={`pad-${index}`} className="h-8" />;
            }

            const count = byDate.get(cell.dateKey)?.length ?? 0;
            const isSelected = selectedDate === cell.dateKey;
            const isToday = cell.dateKey === todayKey;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() =>
                  setSelectedDate((current) => (current === cell.dateKey ? null : cell.dateKey))
                }
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted/70",
                )}
              >
                {cell.day}
                {count > 0 ? (
                  <span
                    className={cn(
                      "absolute bottom-0.5 h-1 w-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-primary",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Reminders</h4>

        {followups.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reminders...</p>
        ) : followups.isError ? (
          <p className="text-sm text-muted-foreground">Unable to load reminders.</p>
        ) : selectedDate ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {formatDayLabel(selectedDate)}
            </p>
            {(byDate.get(selectedDate) ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No reminders on this day.</p>
            ) : (
              <ul className="space-y-2">
                {(byDate.get(selectedDate) ?? []).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/leads/${item.id}`}
                      className="block border-2 border-black bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                    >
                      <p className="truncate text-sm font-medium">{item.leadName}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[item.type]} · {formatTime(item.nextFollowupAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : sortedDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming follow-ups in the next 14 days.
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedDates.map((dateKey) => {
              const items = byDate.get(dateKey) ?? [];
              const counts = summarizeDay(items);
              return (
                <li key={dateKey}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(dateKey)}
                    className="w-full border-2 border-black bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatDayLabel(dateKey)}</span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{summaryText(counts)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  if (variant === "neubrutal") {
    const panel = (
      <div className={cn("sticky top-24 space-y-8", className)}>
        <NeuStickyNote>
          <div className="mb-4 flex items-center gap-2">
            <BellRing className="h-6 w-6" />
            <h3 className="font-heading text-xl font-bold uppercase tracking-tight">Reminders</h3>
          </div>

          {followups.isLoading ? (
            <p className="text-sm font-medium">Loading reminders...</p>
          ) : followups.isError ? (
            <p className="text-sm font-medium">Unable to load reminders.</p>
          ) : upcomingItems.length === 0 ? (
            <p className="text-sm font-medium">No upcoming follow-ups in the next 14 days.</p>
          ) : (
            <ul className="space-y-4">
              {upcomingItems.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={checked.has(item.id)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    className="mt-1 h-5 w-5 border-2 border-black accent-black"
                  />
                  <div>
                    <Link
                      href={`/leads/${item.id}`}
                      className="font-bold leading-tight hover:underline"
                    >
                      {item.leadName}
                    </Link>
                    <p className="mt-1 text-xs font-medium uppercase">
                      {TYPE_LABELS[item.type]} · {dueLabel(item.nextFollowupAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <NeuButton className="mt-6 w-full py-2 text-sm uppercase" variant="default">
            Add Note
          </NeuButton>
        </NeuStickyNote>

        <NeuCard className="bg-[#204060] p-6 text-white" hover={false}>
          <h4 className="mb-2 font-heading font-bold uppercase">Pro Tip</h4>
          <p className="text-sm italic opacity-90">
            &ldquo;The best time to call a lead is within 5 minutes of their inquiry. Strike while
            the iron is hot!&rdquo;
          </p>
        </NeuCard>
      </div>
    );

    if (collapsible) {
      return (
        <div className={className}>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mb-3 flex w-full items-center justify-between font-heading text-lg font-bold uppercase"
          >
            Reminders
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {expanded ? panel : null}
        </div>
      );
    }

    return panel;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Reminders</CardTitle>
          </div>
          {collapsible ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </CardHeader>
      {(!collapsible || expanded) && (
        <CardContent className="space-y-5">{calendarContent}</CardContent>
      )}
    </Card>
  );
}
