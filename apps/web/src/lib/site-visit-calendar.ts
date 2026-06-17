/** Client-side calendar export for site visits (Google Calendar URL + RFC 5545 .ics). */

export type SiteVisitCalendarEvent = {
  id: string;
  leadName: string;
  phone?: string | null;
  projectName?: string | null;
  visitDate: string;
  visitTime: string;
  duration: number;
  propertyAddress?: string | null;
  propertyLabel?: string | null;
  notes?: string | null;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function parseVisitStart(visitDate: string, visitTime: string): Date {
  const [year, month, day] = visitDate.split("-").map(Number);
  const [hours, minutes] = visitTime.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0);
}

export function visitEndDate(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}

/** Google Calendar template format: YYYYMMDDTHHmmss */
export function formatGoogleCalendarDateTime(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}00`
  );
}

export function buildVisitCalendarDetails(event: SiteVisitCalendarEvent): string {
  const parts = [`Lead: ${event.leadName}`];
  if (event.phone) parts.push(`Phone: ${event.phone}`);
  if (event.projectName) parts.push(`Project: ${event.projectName}`);
  if (event.notes?.trim()) parts.push(`Notes: ${event.notes.trim()}`);
  return parts.join(" | ");
}

export function resolveVisitLocation(event: SiteVisitCalendarEvent): string {
  return (event.propertyAddress ?? event.propertyLabel ?? "").trim();
}

export function buildGoogleCalendarUrl(event: SiteVisitCalendarEvent): string {
  const start = parseVisitStart(event.visitDate, event.visitTime);
  const end = visitEndDate(start, event.duration);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.leadName} Site Visit`,
    dates: `${formatGoogleCalendarDateTime(start)}/${formatGoogleCalendarDateTime(end)}`,
    details: buildVisitCalendarDetails(event),
    location: resolveVisitLocation(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsLocalDateTime(date: Date): string {
  return formatGoogleCalendarDateTime(date);
}

function formatIcsUtcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildSiteVisitIcs(event: SiteVisitCalendarEvent): string {
  const start = parseVisitStart(event.visitDate, event.visitTime);
  const end = visitEndDate(start, event.duration);
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PropNinja CRM//Site Visit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:propninja-visit-${event.id}@propninja`,
    `DTSTAMP:${formatIcsUtcStamp(now)}`,
    `DTSTART:${formatIcsLocalDateTime(start)}`,
    `DTEND:${formatIcsLocalDateTime(end)}`,
    `SUMMARY:${escapeIcsText(`${event.leadName} Site Visit`)}`,
    `DESCRIPTION:${escapeIcsText(buildVisitCalendarDetails(event))}`,
  ];

  const location = resolveVisitLocation(event);
  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadSiteVisitIcs(event: SiteVisitCalendarEvent) {
  const blob = new Blob([buildSiteVisitIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `propninja-visit-${event.id}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function openGoogleCalendar(event: SiteVisitCalendarEvent) {
  window.open(buildGoogleCalendarUrl(event), "_blank", "noopener,noreferrer");
}
