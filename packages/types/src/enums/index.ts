export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "negotiation",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TEMPERATURES = ["cold", "warm", "hot"] as const;

export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const CALL_DIRECTIONS = ["incoming", "outgoing"] as const;

export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_STATUSES = ["completed", "missed", "rejected", "failed"] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_SOURCES = ["mobile-manual", "mobile-auto"] as const;

export type CallSource = (typeof CALL_SOURCES)[number];

export const ACTIVITY_TYPES = ["call", "note", "status_change", "meeting", "task"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const USER_ROLES = ["admin", "manager", "agent"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const CONSENT_TYPES = ["call", "sms", "email"] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];
