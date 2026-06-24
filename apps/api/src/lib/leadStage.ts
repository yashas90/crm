import { LEAD_STATUSES, type LeadStatus } from "@propninja/types/enums";

/** Display labels → API slug (qualified = Site Visit on mobile). */
const STAGE_ALIASES: Record<string, LeadStatus> = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  "site visit": "qualified",
  "site visit scheduled": "qualified",
  "meeting scheduled": "qualified",
  negotiation: "negotiation",
  "expression of interest": "negotiation",
  won: "won",
  booked: "won",
  lost: "lost",
  "not interested": "not_interested",
  dropped: "dropped",
  callback: "contacted",
};

export function normalizeLeadStageInput(value: string): LeadStatus | null {
  return normalizeLeadStatusInput(value);
}

/** Normalize mobile display labels and API slugs to a lead status enum value. */
export function normalizeLeadStatusInput(value: string): LeadStatus | null {
  const key = value.trim().toLowerCase();
  if (STAGE_ALIASES[key]) return STAGE_ALIASES[key];
  if ((LEAD_STATUSES as readonly string[]).includes(key)) {
    return key as LeadStatus;
  }
  const underscored = key.replace(/\s+/g, "_");
  if ((LEAD_STATUSES as readonly string[]).includes(underscored)) {
    return underscored as LeadStatus;
  }
  return null;
}
