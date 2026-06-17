"use client";

import { ScheduleVisitDialog } from "@/components/site-visits/schedule-visit-dialog";
import { VisitDetailSlideOver } from "@/components/site-visits/visit-detail-slide-over";
import {
  type SiteVisit,
  formatVisitTime,
  useSiteVisitsCalendar,
  visitStatusColor,
} from "@/hooks/use-site-visits";
import { Button } from "@propninja/ui/button";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { type ComponentType, useMemo, useState } from "react";
import { Calendar, type CalendarProps, type View, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-IN": undefined };
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

const SiteVisitCalendar = Calendar as ComponentType<CalendarProps<CalendarEvent>>;

function visitToEvent(visit: SiteVisit): CalendarEvent {
  const [h, m, s] = visit.visitTime.split(":").map(Number);
  const start = new Date(`${visit.visitDate}T00:00:00`);
  start.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
  const end = new Date(start.getTime() + visit.duration * 60_000);
  const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}` : "Visit";
  return {
    id: visit.id,
    title: leadName,
    start,
    end,
    resource: visit,
  };
}

type SiteVisitsCalendarProps = {
  agentId?: string;
  initialDate?: Date;
};

export function SiteVisitsCalendar({ agentId, initialDate }: SiteVisitsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(initialDate ?? new Date());
  const [view, setView] = useState<View>("month");
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

  const { data, isLoading } = useSiteVisitsCalendar(rangeStart, rangeEnd, agentId);

  const events = useMemo(() => {
    const visits = Object.values(data?.dates ?? {}).flat();
    return visits.map(visitToEvent);
  }, [data?.dates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site visits</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track property visits with leads
          </p>
        </div>
        <Button onClick={() => setScheduleOpen(true)}>Schedule visit</Button>
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

      <div className="min-h-[640px] rounded-xl border border-border bg-card p-3 [&_.rbc-event]:text-white [&_.rbc-event]:text-xs">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading calendar…</p>
        ) : (
          <SiteVisitCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={setView}
            date={currentDate}
            onNavigate={setCurrentDate}
            views={["month", "week", "day"]}
            popup
            style={{ height: 600 }}
            onSelectEvent={(event: CalendarEvent) => setSelectedVisit(event.resource)}
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
