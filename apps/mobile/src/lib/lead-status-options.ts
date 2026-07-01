import type { LeadStatus } from "@propninja/types/enums";

/** Statuses that require closeReason on PATCH /api/leads/:id (must match API route). */
export const TERMINAL_LEAD_STATUSES_REQUIRING_CLOSE_REASON = ["lost", "not_interested"] as const;

/** Statuses that auto-unassign the lead and move it to the NA pool. */
export const NA_LEAD_STATUSES = ["not_interested", "dropped"] as const;

export function isNaLeadStatus(status: string): boolean {
  return (NA_LEAD_STATUSES as readonly string[]).includes(status);
}

export type MobileLeadStatusOption = {
  label: string;
  value: LeadStatus;
};

/** Agent-friendly labels mapped to CRM lead statuses. */
export const MOBILE_LEAD_STATUS_OPTIONS: MobileLeadStatusOption[] = [
  { label: "Callback", value: "contacted" },
  { label: "Meeting Scheduled", value: "qualified" },
  { label: "Site Visit Scheduled", value: "qualified" },
  { label: "Expression Of Interest", value: "negotiation" },
  { label: "Booked", value: "won" },
  { label: "Not Interested", value: "not_interested" },
  { label: "Dropped", value: "dropped" },
];

export function formatLeadStatusLabel(status: string | null | undefined): string {
  if (!status) return "No previous status found";
  const match = MOBILE_LEAD_STATUS_OPTIONS.find((o) => o.value === status);
  if (match) return match.label;
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function buildLeadStatusPatch(
  payload: {
    leadStatus: LeadStatus;
    assignedTo?: string;
    closeReason?: string;
    closeReasonNote?: string;
  },
  lead: {
    assignedUser?: { id: string } | null;
  },
  options: { canReassign: boolean },
): Record<string, unknown> {
  const patch: Record<string, unknown> = { leadStatus: payload.leadStatus };

  if (
    (TERMINAL_LEAD_STATUSES_REQUIRING_CLOSE_REASON as readonly string[]).includes(
      payload.leadStatus,
    )
  ) {
    patch.closeReason = payload.closeReason?.trim() || "other";
    const note = payload.closeReasonNote?.trim();
    if (note) patch.closeReasonNote = note;
  }

  if (
    options.canReassign &&
    isUuid(payload.assignedTo) &&
    payload.assignedTo !== lead.assignedUser?.id
  ) {
    patch.assignedTo = payload.assignedTo;
  }

  return patch;
}
