"use client";

import {
  type SiteVisitCalendarEvent,
  downloadSiteVisitIcs,
  openGoogleCalendar,
} from "@/lib/site-visit-calendar";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { CalendarPlus, ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AddToCalendarDropdownProps = {
  event: SiteVisitCalendarEvent;
  className?: string;
};

export function AddToCalendarDropdown({ event, className }: AddToCalendarDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(mouseEvent: MouseEvent) {
      if (!rootRef.current?.contains(mouseEvent.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-2", className?.includes("w-full") && "w-full")}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CalendarPlus className="h-4 w-4" />
        Add to Calendar
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              openGoogleCalendar(event);
              setOpen(false);
            }}
          >
            <CalendarPlus className="h-4 w-4 text-primary" />
            Google Calendar
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              downloadSiteVisitIcs(event);
              setOpen(false);
            }}
          >
            <Download className="h-4 w-4 text-primary" />
            Download .ics
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function siteVisitToCalendarEvent(visit: {
  id: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  notes?: string | null;
  propertyAddress?: string | null;
  propertyLabel?: string | null;
  lead?: { firstName: string; lastName: string; phone?: string | null } | null;
  project?: { name: string } | null;
}): SiteVisitCalendarEvent {
  return {
    id: visit.id,
    leadName: visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead",
    phone: visit.lead?.phone ?? null,
    projectName: visit.project?.name ?? null,
    visitDate: visit.visitDate,
    visitTime: visit.visitTime,
    duration: visit.duration,
    propertyAddress: visit.propertyAddress,
    propertyLabel: visit.propertyLabel,
    notes: visit.notes,
  };
}
