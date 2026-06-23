import type { LeadStatus } from "@propninja/types/enums";

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
  { label: "Not Interested", value: "lost" },
  { label: "Dropped", value: "lost" },
];

export function formatLeadStatusLabel(status: string | null | undefined): string {
  if (!status) return "No previous status found";
  const match = MOBILE_LEAD_STATUS_OPTIONS.find((o) => o.value === status);
  if (match) return match.label;
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}
