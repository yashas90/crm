export const AD_LEAD_SOURCE_LABELS = ["Meta Ads", "Google Ads"] as const;

export const AD_LEAD_TAG = "ad_lead";

/** Canonical values stored on new leads (matches ad ingest labels for ad platforms). */
export const LEAD_SOURCE_OPTIONS = [
  { value: "Website", label: "Website" },
  { value: "Referral", label: "Referral" },
  { value: "Walk In", label: "Walk In" },
  { value: "Meta Ads", label: "Meta Ads" },
  { value: "Google Ads", label: "Google Ads" },
  { value: "Cold Call", label: "Cold Call" },
  { value: "Other", label: "Other" },
] as const;

export const LEAD_SOURCE_VALUES = LEAD_SOURCE_OPTIONS.map((option) => option.value);

/** Sentinel value for the advanced filters “All Ad Leads” option. */
export const AD_LEADS_FILTER_VALUE = "__ad_leads__";

/** LeadRat-style source filter chips on the leads list. */
export const LEADS_SOURCE_FILTER_CHIPS = [
  { value: "", label: "All Sources" },
  { value: "Meta Ads", label: "Facebook / Meta" },
  { value: "Google Ads", label: "Google Ads" },
  { value: "Magicbricks", label: "MagicBricks" },
  { value: "99 Acres", label: "99 Acres" },
  { value: "Housing.com", label: "Housing" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Website", label: "Website" },
  { value: "Referral", label: "Referral" },
  { value: "Walk In", label: "Walk In" },
  { value: "Cold Call", label: "Cold Call" },
  { value: "Other", label: "Other" },
] as const;

export const LEADS_PRIMARY_SCOPES = [
  { id: "all" as const, label: "All Leads" },
  { id: "my" as const, label: "My Leads" },
  { id: "teams" as const, label: "Team" },
];

export const LEADS_SECONDARY_SCOPES = [
  { id: "unassigned" as const, label: "Unassigned", adminOnly: false },
  { id: "sla" as const, label: "SLA", adminOnly: false },
  { id: "naleads" as const, label: "NA Leads", adminOnly: true },
  { id: "deleted" as const, label: "Deleted", adminOnly: false },
  { id: "duplicate" as const, label: "Duplicate", adminOnly: false },
  { id: "re-enquired" as const, label: "Re-Enquired", adminOnly: false },
];

export const AD_PLATFORM_SOURCE_OPTIONS = LEAD_SOURCE_OPTIONS.filter((option) =>
  (AD_LEAD_SOURCE_LABELS as readonly string[]).includes(option.value),
);

export const OTHER_LEAD_SOURCE_OPTIONS = LEAD_SOURCE_OPTIONS.filter(
  (option) => !(AD_LEAD_SOURCE_LABELS as readonly string[]).includes(option.value),
);

const bulkUploadSourceChipValues: string[] = LEADS_SOURCE_FILTER_CHIPS.filter(
  (chip) => chip.value,
).map((chip) => chip.value);

/** Source picker for bulk CSV import (portals, ads, and manual channels). */
export const BULK_UPLOAD_SOURCE_OPTIONS = [
  ...bulkUploadSourceChipValues.map((value) => {
    const chip = LEADS_SOURCE_FILTER_CHIPS.find((item) => item.value === value);
    return { value, label: chip?.label ?? value };
  }),
  ...LEAD_SOURCE_OPTIONS.filter((option) => !bulkUploadSourceChipValues.includes(option.value)).map(
    (option) => ({ value: option.value, label: option.label }),
  ),
];

const LEGACY_TO_CANONICAL: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  "walk-in": "Walk In",
  walkin: "Walk In",
  "walk in": "Walk In",
  facebook: "Meta Ads",
  "facebook ads": "Meta Ads",
  "meta ads": "Meta Ads",
  "facebook / meta": "Meta Ads",
  "facebook/meta": "Meta Ads",
  meta: "Meta Ads",
  fb: "Meta Ads",
  "google-ads": "Google Ads",
  googleads: "Google Ads",
  google: "Google Ads",
  "cold-call": "Cold Call",
  cold_call: "Cold Call",
  coldcall: "Cold Call",
  other: "Other",
  magicbricks: "Magicbricks",
  "magic bricks": "Magicbricks",
  "99acres": "99 Acres",
  whatsapp: "WhatsApp",
  "housing.com": "Housing.com",
  housing: "Housing.com",
};

/** Display label for any stored lead_source (canonical or legacy slug). */
export function formatLeadSourceDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const trimmed = value.trim();
  if (LEAD_SOURCE_VALUES.includes(trimmed as (typeof LEAD_SOURCE_VALUES)[number])) {
    return trimmed;
  }
  const legacy = LEGACY_TO_CANONICAL[trimmed.toLowerCase()];
  if (legacy) return legacy;
  if (trimmed === "Facebook Ads") return "Meta Ads";
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Normalize a filter or form value to the canonical label sent to the API. */
export function normalizeLeadSourceValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Exact canonical match (incl. portal chips)
  if (
    LEAD_SOURCE_VALUES.includes(trimmed as (typeof LEAD_SOURCE_VALUES)[number]) ||
    LEADS_SOURCE_FILTER_CHIPS.some((chip) => chip.value === trimmed)
  ) {
    return trimmed;
  }
  // Legacy alias lookup (case-insensitive)
  return LEGACY_TO_CANONICAL[trimmed.toLowerCase()] ?? trimmed;
}

export function isAdLeadLead(lead: {
  leadSource?: string | null;
  tags?: string[] | null;
}): boolean {
  const source = lead.leadSource?.trim() ?? "";
  if ((AD_LEAD_SOURCE_LABELS as readonly string[]).includes(source)) return true;
  const canonical = LEGACY_TO_CANONICAL[source.toLowerCase()];
  if (canonical === "Meta Ads" || canonical === "Google Ads") return true;
  if (source === "Facebook Ads") return true;
  return (lead.tags ?? []).includes(AD_LEAD_TAG);
}

export type AdLeadCustomFields = {
  source?: string;
  externalLeadId?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  formId?: string | null;
  formName?: string | null;
  ingestedAt?: string;
};

export function getAdLeadInfo(customFields?: Record<string, unknown> | null): {
  payload: AdLeadCustomFields | null;
  ingestedAt?: string;
} {
  if (!customFields) return { payload: null };

  const lastAdLead = customFields.lastAdLead as AdLeadCustomFields | undefined;
  const adLead = customFields.adLead as AdLeadCustomFields | undefined;
  const payload = lastAdLead ?? adLead ?? null;

  return {
    payload,
    ingestedAt: lastAdLead?.ingestedAt,
  };
}
