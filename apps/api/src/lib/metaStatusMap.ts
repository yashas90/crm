/**
 * Maps CRM lead lifecycle events to Meta Conversions API (CAPI) standard event names.
 *
 * Mapping (per Meta Business Integration spec):
 *   lead.leadStatus  "new"          → "Lead"           (initial ad-lead ingest)
 *   lead.leadStatus  "contacted"    → "Contact"
 *   lead.leadStatus  "qualified"    → "QualifiedLead"
 *   site visit scheduled            → "Schedule"
 *   lead.leadStatus  "won"          → "Purchase"
 *
 * Statuses with no advertiser-meaningful CAPI event ("negotiation", "lost",
 * "not_interested", "dropped") intentionally map to `null` — callers should
 * skip sending a conversion event for these.
 */

export type CapiEventName = "Lead" | "Contact" | "QualifiedLead" | "Schedule" | "Purchase";

export type CrmLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "negotiation"
  | "won"
  | "lost"
  | "not_interested"
  | "dropped";

const LEAD_STATUS_TO_CAPI_EVENT: Partial<Record<CrmLeadStatus, CapiEventName>> = {
  new: "Lead",
  contacted: "Contact",
  qualified: "QualifiedLead",
  won: "Purchase",
};

/** Maps a CRM `leads.lead_status` value to a CAPI event name, or `null` if no event should be sent. */
export function mapLeadStatusToCapiEvent(status: string): CapiEventName | null {
  return LEAD_STATUS_TO_CAPI_EVENT[status as CrmLeadStatus] ?? null;
}

/** Site-visit scheduling always maps to the CAPI "Schedule" standard event. */
export function mapSiteVisitToCapiEvent(): CapiEventName {
  return "Schedule";
}

/** True when a lead-status transition should trigger a CAPI event send. */
export function isCapiTrackedLeadStatus(status: string): boolean {
  return mapLeadStatusToCapiEvent(status) !== null;
}
