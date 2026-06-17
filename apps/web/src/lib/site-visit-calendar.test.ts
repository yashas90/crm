import { describe, expect, it } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildSiteVisitIcs,
  formatGoogleCalendarDateTime,
  parseVisitStart,
} from "./site-visit-calendar";

describe("site-visit-calendar", () => {
  const event = {
    id: "visit-abc",
    leadName: "Ravi Kumar",
    phone: "+919876543210",
    projectName: "Green Heights",
    visitDate: "2025-06-16",
    visitTime: "10:30",
    duration: 60,
    propertyAddress: "12 MG Road, Bangalore",
    notes: "Bring brochures",
  };

  it("formats Google Calendar date/time", () => {
    const start = parseVisitStart("2025-06-16", "10:30");
    expect(formatGoogleCalendarDateTime(start)).toBe("20250616T103000");
  });

  it("builds Google Calendar URL with visit fields", () => {
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Ravi");
    expect(url).toContain("dates=20250616T103000%2F20250616T113000");
    expect(url).toContain("Green+Heights");
    expect(url).toContain("MG+Road");
  });

  it("generates RFC 5545 .ics content", () => {
    const ics = buildSiteVisitIcs(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:propninja-visit-visit-abc@propninja");
    expect(ics).toContain("DTSTART:20250616T103000");
    expect(ics).toContain("DTEND:20250616T113000");
    expect(ics).toContain("SUMMARY:Ravi Kumar Site Visit");
    expect(ics).toContain("LOCATION:12 MG Road\\, Bangalore");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
