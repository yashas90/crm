import { LEAD_STATUSES, type LeadStatus } from "@propninja/types/enums";

/** Display labels → API slug (qualified = Site Visit on mobile). */
const STAGE_ALIASES: Record<string, LeadStatus> = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  "site visit": "qualified",
  negotiation: "negotiation",
  won: "won",
  lost: "lost",
};

export function normalizeLeadStageInput(value: string): LeadStatus | null {
  const key = value.trim().toLowerCase();
  if (STAGE_ALIASES[key]) return STAGE_ALIASES[key];
  if ((LEAD_STATUSES as readonly string[]).includes(key)) {
    return key as LeadStatus;
  }
  return null;
}
