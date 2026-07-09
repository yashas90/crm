"use client";

import { ScheduleVisitDialog } from "@/components/site-visits/schedule-visit-dialog";
import { VisitDetailSlideOver } from "@/components/site-visits/visit-detail-slide-over";
import {
  type SiteVisit,
  type SiteVisitStatus,
  formatVisitTime,
  useSiteVisitSummary,
  useSiteVisitsCalendar,
  useUpdateSiteVisit,
  visitStatusColor,
} from "@/hooks/use-site-visits";
import { toast } from "@/lib/toast";
import { parseVisitStartIst } from "@propninja/types/ist";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { enIN } from "date-fns/locale/en-IN";
import { AlertCircle } from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";
import { Calendar, type CalendarProps, type View, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-IN": enIN };
const localizer = dateFnsLocalizer({
  format,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay: (date: Date) => date.getDay(),
  locales,
});

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SiteVisit;
};

const DragDropCalendar = withDragAndDrop(Calendar) as ComponentType<
  CalendarProps<CalendarEvent> & {
    resizable?: boolean;
    onEventDrop?: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
    onEventResize?: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
    draggableAccessor?: (event: CalendarEvent) => boolean;
  }
>;

function visitToEvent(visit: SiteVisit): CalendarEvent {
  const dateKey = visit.visitDate.slice(0, 10);
  const start = parseVisitStartIst(dateKey, visit.visitTime);
  const end = new Date(start.getTime() + visit.duration * 60_000);
  const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}` : "Visit";
  return {
    id: visit.id,
    title: leadName.trim() || "Visit",
    start,
    end,
    resource: visit,
  };
}

type StatusTab = "all" | SiteVisitStatus | "today" | "upcoming" | "missed";

const SUMMARY_TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "no_show", label: "Missed" },
];

type SiteVisitsCalendarProps = {
  agentId?: string;
  initialDate?: Date;
};

export function SiteVisitsCalendar({ agentId, initialDate }: SiteVisitsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(initialDate ?? new Date());
  const [view, setView] = useState<View>("month");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const rangeStart =
    view === "month"
      ? format(startOfMonth(currentDate), "yyyy-MM-dd")
      : format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const rangeEnd =
    view === "month"
      ? format(endOfMonth(currentDate), "yyyy-MM-dd")
      : format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const calendarQuery = useSiteVisitsCalendar(rangeStart, rangeEnd, agentId);
  const summaryQuery = useSiteVisitSummary(agentId);
  const updateVisit = useUpdateSiteVisit();

  const events = useMemo(() => {
    const visits = Object.values(calendarQuery.data?.dates ?? {}).flat();
    const todayKey = format(new Date(), "yyyy-MM-dd");
    return visits
      .filter((visit) => {
        if (statusTab === "all") return true;
        if (statusTab === "today") return visit.visitDate.slice(0, 10) === todayKey;
        if (statusTab === "upcoming")
          return visit.status === "scheduled" && visit.visitDate.slice(0, 10) >= todayKey;
        if (statusTab === "missed") return visit.status === "no_show";
        return visit.status === statusTab;
      })
      .map(visitToEvent);
  }, [calendarQuery.data?.dates, statusTab]);

  const showCalendarError = calendarQuery.isError && !calendarQuery.isLoading;

  async function handleRescheduleDrop(event: CalendarEvent, start: Date, end: Date) {
    if (event.resource.status !== "scheduled") {
      toast.error("Only scheduled visits can be rescheduled by drag-and-drop.");
      return;
    }
    const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
    try {
      await updateVisit.mutateAsync({
        id: event.resource.id,
        payload: {
          visitDate: format(start, "yyyy-MM-dd"),
          visitTime: format(start, "HH:mm"),
          duration,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reschedule visit");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site visits</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track property visits — drag events to reschedule
          </p>
        </div>
        <Button onClick={() => setScheduleOpen(true)}>Schedule visit</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusTab("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            statusTab === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {SUMMARY_TABS.map((tab) => {
          const count =
            tab.id === "today"
              ? summaryQuery.data?.today
              : tab.id === "upcoming"
                ? summaryQuery.data?.upcoming
                : tab.id === "completed"
                  ? summaryQuery.data?.completed
                  : tab.id === "cancelled"
                    ? summaryQuery.data?.cancelled
                    : tab.id === "no_show"
                      ? summaryQuery.data?.missed
                      : undefined;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusTab === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {count !== undefined ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(
          [
            ["scheduled", "Scheduled"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
            ["no_show", "No show"],
          ] as const
        ).map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: visitStatusColor(status) }}
            />
            {label}
          </span>
        ))}
      </div>

      <div className="min-h-[640px] rounded-xl border border-slate-200/80 bg-card p-3 dark:border-white/10 [&_.rbc-event]:text-white [&_.rbc-event]:text-xs">
        {calendarQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading calendar…</p>
        ) : showCalendarError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Could not load site visits for this period.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void calendarQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <DragDropCalendar
            localizer={localizer}
            culture="en-IN"
            events={events}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            views={["month", "week", "day"]}
            popup
            resizable
            style={{ height: 600 }}
            onSelectEvent={(event: CalendarEvent) => setSelectedVisit(event.resource)}
            onEventDrop={({
              event,
              start,
              end,
            }: { event: CalendarEvent; start: Date; end: Date }) =>
              void handleRescheduleDrop(event, start, end)
            }
            onEventResize={({
              event,
              start,
              end,
            }: { event: CalendarEvent; start: Date; end: Date }) =>
              void handleRescheduleDrop(event, start, end)
            }
            draggableAccessor={(event: CalendarEvent) => event.resource.status === "scheduled"}
            eventPropGetter={(event: CalendarEvent) => ({
              style: {
                backgroundColor: visitStatusColor(event.resource.status),
                border: "none",
              },
            })}
            tooltipAccessor={(event: CalendarEvent) =>
              `${event.title} · ${formatVisitTime(event.resource.visitTime)} · ${event.resource.propertyLabel ?? "Property"}`
            }
          />
        )}
      </div>

      <VisitDetailSlideOver
        visit={selectedVisit}
        open={Boolean(selectedVisit)}
        onOpenChange={(open) => {
          if (!open) setSelectedVisit(null);
        }}
      />

      <ScheduleVisitDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
