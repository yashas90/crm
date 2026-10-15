import { parseVisitStartIst } from "./ist.js";

/** Planned slot length stays on site_visits.duration. Checkout length is duration_minutes. */
export const SITE_VISIT_TRACKING_STATUSES = [
  "scheduled",
  "reminder_sent",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
] as const;

export type SiteVisitTrackingStatus = (typeof SITE_VISIT_TRACKING_STATUSES)[number];

export const VISIT_COMPANIONS = ["just_customer", "plus_1", "plus_2", "family"] as const;
export type VisitCompanions = (typeof VISIT_COMPANIONS)[number];

export const VISIT_COMPANION_LABELS: Record<VisitCompanions, string> = {
  just_customer: "Just customer",
  plus_1: "+1",
  plus_2: "+2",
  family: "Family",
};

export const CHECKIN_OPEN_MINUTES = 30;
export const OVERDUE_CHECKIN_MINUTES = 15;
export const DEFAULT_CHECKIN_RADIUS_METERS = 200;

export const VISIT_OUTCOMES = [
  "deal_closed",
  "very_interested",
  "negotiating",
  "interested",
  "needs_time",
  "wants_different_property",
  "not_interested",
  "revisit_required",
] as const;

export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];

export const VISIT_NEXT_ACTIONS = [
  "follow_up_call",
  "second_visit",
  "payment_plan",
  "negotiation",
  "booking",
  "drop_lead",
] as const;

export type VisitNextAction = (typeof VISIT_NEXT_ACTIONS)[number];

export type VisitLeadEvent =
  | "schedule"
  | "interested"
  | "needs_time"
  | "very_interested"
  | "negotiating"
  | "wants_different_property"
  | "not_interested"
  | "deal_closed";

export type MappedLeadStage = {
  pipelineStage: string;
  leadStatus: "new" | "contacted" | "qualified" | "negotiation" | "won" | "lost";
};

/**
 * Outcome → fields the rest of the CRM already understands.
 * pipeline_stage: site_visit_scheduled, site_visit_done, negotiation, closed_won,
 * closed_lost, contacted (morning brief and calling data already use these).
 * lead_status has no site-visit value. site_visit_scheduled and site_visit_done
 * map to qualified, the same closest status pipelineStageToLeadStatus already uses.
 * - schedule → site_visit_scheduled (lead_status qualified)
 * - interested / needs_time → site_visit_done (lead_status qualified)
 * - very_interested / negotiating → negotiation
 * - wants_different_property → contacted
 * - not_interested → closed_lost / lost (not_interested exists but the spec asks for lost)
 * - deal_closed → closed_won / won
 */
export function mapVisitEventToLeadStatus(event: VisitLeadEvent): MappedLeadStage {
  switch (event) {
    case "schedule":
      return { pipelineStage: "site_visit_scheduled", leadStatus: "qualified" };
    case "interested":
    case "needs_time":
      return { pipelineStage: "site_visit_done", leadStatus: "qualified" };
    case "very_interested":
    case "negotiating":
      return { pipelineStage: "negotiation", leadStatus: "negotiation" };
    case "wants_different_property":
      return { pipelineStage: "contacted", leadStatus: "contacted" };
    case "not_interested":
      return { pipelineStage: "closed_lost", leadStatus: "lost" };
    case "deal_closed":
      return { pipelineStage: "closed_won", leadStatus: "won" };
  }
}

export function outcomeToLeadEvent(outcome: VisitOutcome): VisitLeadEvent | null {
  switch (outcome) {
    case "deal_closed":
      return "deal_closed";
    case "very_interested":
      return "very_interested";
    case "negotiating":
      return "negotiating";
    case "interested":
      return "interested";
    case "needs_time":
    case "revisit_required":
      return "needs_time";
    case "wants_different_property":
      return "wants_different_property";
    case "not_interested":
      return "not_interested";
    default:
      return null;
  }
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function withinRadius(distanceMeters: number, radiusMeters = DEFAULT_CHECKIN_RADIUS_METERS) {
  return distanceMeters <= radiusMeters;
}

export function visitStart(visitDate: string, visitTime: string, scheduledAt?: string | null) {
  if (scheduledAt) {
    const parsed = new Date(scheduledAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return parseVisitStartIst(visitDate, visitTime);
}

/** Null when check-in is allowed. Otherwise the 400 message. */
export function checkInTooEarlyMessage(
  visitDate: string,
  visitTime: string,
  now = new Date(),
  scheduledAt?: string | null,
): string | null {
  const start = visitStart(visitDate, visitTime, scheduledAt);
  const opensAt = start.getTime() - CHECKIN_OPEN_MINUTES * 60_000;
  if (now.getTime() < opensAt) {
    return "Check-in opens 30 minutes before the scheduled time";
  }
  return null;
}

export function isOverdueCheckIn(
  status: string,
  visitDate: string,
  visitTime: string,
  now = new Date(),
  scheduledAt?: string | null,
) {
  if (status !== "scheduled" && status !== "reminder_sent") return false;
  const start = visitStart(visitDate, visitTime, scheduledAt);
  return now.getTime() > start.getTime() + OVERDUE_CHECKIN_MINUTES * 60_000;
}

export function clockMinutes(visitTime: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(visitTime.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 09:00–19:00 IST on a 30-minute grid, and not in the past. */
export function validateVisitSlot(
  visitDate: string,
  visitTime: string,
  now = new Date(),
): string | null {
  const minutes = clockMinutes(visitTime);
  if (minutes == null || minutes % 30 !== 0 || minutes < 9 * 60 || minutes > 19 * 60) {
    return "Choose a 30-minute slot between 9:00 and 19:00 IST";
  }
  if (visitStart(visitDate, visitTime).getTime() < now.getTime()) {
    return "Site visits cannot be scheduled in the past";
  }
  return null;
}

export function visitTimeSlots(): string[] {
  const slots: string[] = [];
  for (let minutes = 9 * 60; minutes <= 19 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return slots;
}

export function relativeVisitLabel(visitDate: string, visitTime: string, now = new Date()) {
  const diff = Math.round((visitStart(visitDate, visitTime).getTime() - now.getTime()) / 60_000);
  if (diff === 0) return "now";
  if (diff === 1) return "in 1 minute";
  if (diff > 1 && diff < 60) return `in ${diff} minutes`;
  if (diff >= 60 && diff < 120) return "in 1 hour";
  if (diff >= 120) return `in ${Math.round(diff / 60)} hours`;
  if (diff === -1) return "1 minute ago";
  if (diff > -60) return `${Math.abs(diff)} minutes ago`;
  return `${Math.round(Math.abs(diff) / 60)} hours ago`;
}

export type VisitPinColor = "green" | "blue" | "yellow" | "red" | "slate";

export function visitPinColor(
  status: string,
  visitDate: string,
  visitTime: string,
  now = new Date(),
): VisitPinColor {
  if (
    status === "no_show" ||
    status === "cancelled" ||
    isOverdueCheckIn(status, visitDate, visitTime, now)
  ) {
    return "red";
  }
  if (status === "in_progress" || status === "checked_in") return "green";
  if (status === "completed") return "blue";
  const start = visitStart(visitDate, visitTime);
  const minutesUntil = (start.getTime() - now.getTime()) / 60_000;
  if (
    (status === "scheduled" || status === "reminder_sent") &&
    minutesUntil <= 120 &&
    minutesUntil >= -15
  ) {
    return "yellow";
  }
  return "slate";
}

export function mapsSearchUrl(lat?: number | null, lng?: number | null, address?: string | null) {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
  }
  return null;
}

export function scheduleNotificationCopy(input: {
  leadName: string;
  leadCode?: string | null;
  property: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const code = input.leadCode?.trim() ? ` (${input.leadCode.trim()})` : "";
  return {
    title: "Site visit scheduled",
    message: `Site visit scheduled: ${input.leadName}${code} at ${input.property} on ${input.dateLabel} at ${input.timeLabel} IST.`,
  };
}

export function outcomeNotificationCopy(input: {
  agentName: string;
  leadName: string;
  property: string;
  outcomeLabel: string;
}) {
  return {
    title: "Site visit outcome",
    message: `${input.agentName} finished a site visit with ${input.leadName} at ${input.property}. Outcome: ${input.outcomeLabel}.`,
  };
}

export const FEEDBACK_QUESTIONS = [
  {
    id: "q1",
    prompt: "First reaction",
    answerType: "stars" as const,
    options: ["1", "2", "3", "4", "5"],
  },
  {
    id: "q2",
    prompt: "What did the customer like?",
    answerType: "multi" as const,
    options: [
      "Location",
      "Price",
      "Size/Space",
      "Amenities",
      "Construction",
      "Views",
      "Vastu/Layout",
      "Developer Brand",
    ],
  },
  {
    id: "q3",
    prompt: "Concerns",
    answerType: "multi" as const,
    options: [
      "Price too high",
      "Size too small",
      "Location issues",
      "Floor preference",
      "Facing/direction",
      "Parking",
      "Possession date",
      "Legal concerns",
      "None",
    ],
  },
  {
    id: "q4",
    prompt: "Budget fit",
    answerType: "single" as const,
    options: ["Under budget", "Within budget", "Slightly above", "Too expensive"],
  },
  {
    id: "q5",
    prompt: "Size",
    answerType: "single" as const,
    options: ["Too small", "Just right", "More than needed"],
  },
  {
    id: "q6",
    prompt: "Interest",
    answerType: "single" as const,
    options: [
      "Very Interested",
      "Interested",
      "Needs to think",
      "Not interested",
      "Wants different property",
    ],
  },
  {
    id: "q7",
    prompt: "Comparing other properties?",
    answerType: "single" as const,
    options: ["No", "1-2 others", "many"],
  },
  {
    id: "q8",
    prompt: "Decision makers",
    answerType: "single" as const,
    options: ["all here", "needs spouse/parents", "partially"],
  },
  {
    id: "q9",
    prompt: "Loan",
    answerType: "single" as const,
    options: ["Pre-approved", "Applied", "Planning to apply", "Self-funded", "Unknown"],
  },
  {
    id: "q10",
    prompt: "Booking amount",
    answerType: "single" as const,
    options: ["ready now", "within 1 week", "within 1 month", "not yet"],
  },
  {
    id: "q11",
    prompt: "Agent assessment",
    answerType: "single" as const,
    options: ["Hot", "Warm", "Cold"],
  },
  {
    id: "q12",
    prompt: "Next step",
    answerType: "single" as const,
    options: [
      "follow-up call",
      "second visit",
      "payment plan",
      "negotiation",
      "booking",
      "drop lead",
    ],
  },
  {
    id: "q13",
    prompt: "Follow-up date and time",
    answerType: "datetime" as const,
    options: [] as string[],
  },
] as const;

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  deal_closed: "Deal closed",
  very_interested: "Very interested",
  negotiating: "Negotiating",
  interested: "Interested",
  needs_time: "Needs time",
  wants_different_property: "Wants a different property",
  not_interested: "Not interested",
  revisit_required: "Revisit required",
};
