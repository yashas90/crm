export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "negotiation",
  "won",
  "lost",
  "not_interested",
  "dropped",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TEMPERATURES = ["cold", "warm", "hot"] as const;

export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const CALL_DIRECTIONS = ["incoming", "outgoing"] as const;

export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_STATUSES = ["completed", "missed", "rejected", "failed"] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_SOURCES = ["mobile-manual", "mobile-auto", "web-manual"] as const;

export type CallSource = (typeof CALL_SOURCES)[number];

export const CALL_OUTCOMES = ["answered", "no_answer", "busy", "left_voicemail"] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  answered: "Answered",
  no_answer: "No Answer",
  busy: "Busy",
  left_voicemail: "Left Voicemail",
};

export const ACTIVITY_TYPES = ["call", "note", "status_change", "meeting", "task"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const USER_ROLES = ["admin", "manager", "agent"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const CONSENT_TYPES = ["call", "sms", "email"] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const LEAD_CLOSE_REASONS = [
  "budget_issue",
  "not_serious",
  "competitor",
  "location_mismatch",
  "project_mismatch",
  "no_response",
  "already_purchased",
  "future_requirement",
  "other",
] as const;

export type LeadCloseReason = (typeof LEAD_CLOSE_REASONS)[number];

export const LEAD_CLOSE_REASON_LABELS: Record<LeadCloseReason, string> = {
  budget_issue: "Budget Issue",
  not_serious: "Not Serious",
  competitor: "Went to Competitor",
  location_mismatch: "Location Mismatch",
  project_mismatch: "Project Mismatch",
  no_response: "No Response",
  already_purchased: "Already Purchased",
  future_requirement: "Future Requirement",
  other: "Other",
};

export const VISIT_OUTCOMES = [
  "very_interested",
  "needs_time",
  "not_interested",
  "revisit_required",
] as const;

export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];

export const VISIT_OUTCOME_LABELS: Record<VisitOutcome, string> = {
  very_interested: "Very Interested",
  needs_time: "Needs More Time",
  not_interested: "Not Interested",
  revisit_required: "Revisit Required",
};
