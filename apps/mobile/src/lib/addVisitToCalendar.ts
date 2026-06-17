import { parseVisitStart, visitEndDate } from "./visitCalendarDates";

export type MobileVisitCalendarInput = {
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

export type AddVisitCalendarResult = "added" | "denied" | "unavailable";

export function formatVisitManualDetails(input: MobileVisitCalendarInput): string {
  const location = input.propertyAddress ?? input.propertyLabel ?? "—";
  const lines = [
    `Title: ${input.leadName} Site Visit`,
    `Date: ${input.visitDate}`,
    `Time: ${input.visitTime}`,
    `Duration: ${input.duration} minutes`,
    `Location: ${location}`,
  ];
  if (input.phone) lines.push(`Phone: ${input.phone}`);
  if (input.projectName) lines.push(`Project: ${input.projectName}`);
  if (input.notes?.trim()) lines.push(`Notes: ${input.notes.trim()}`);
  return lines.join("\n");
}

export async function addSiteVisitToDeviceCalendar(
  input: MobileVisitCalendarInput,
): Promise<AddVisitCalendarResult> {
  let Calendar: typeof import("expo-calendar");
  try {
    Calendar = await import("expo-calendar");
  } catch {
    return "unavailable";
  }

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") {
    return "denied";
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((calendar) => calendar.allowsModifications);
  if (!writable) {
    return "unavailable";
  }

  const start = parseVisitStart(input.visitDate, input.visitTime);
  const end = visitEndDate(start, input.duration);
  const noteLines = [`Lead: ${input.leadName}`];
  if (input.phone) noteLines.push(`Phone: ${input.phone}`);
  if (input.projectName) noteLines.push(`Project: ${input.projectName}`);
  if (input.notes?.trim()) noteLines.push(input.notes.trim());

  await Calendar.createEventAsync(writable.id, {
    title: `${input.leadName} Site Visit`,
    startDate: start,
    endDate: end,
    location: input.propertyAddress ?? input.propertyLabel ?? undefined,
    notes: noteLines.join("\n"),
  });

  return "added";
}

export function siteVisitToMobileCalendarInput(visit: {
  id: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  notes?: string | null;
  propertyAddress?: string | null;
  propertyLabel?: string | null;
  lead?: { firstName: string; lastName: string; phone?: string | null } | null;
  project?: { name: string } | null;
}): MobileVisitCalendarInput {
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
