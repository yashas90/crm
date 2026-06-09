export const AD_LEAD_SOURCE_LABELS = ["Facebook Ads", "Google Ads"] as const;

export const AD_LEAD_TAG = "ad_lead";

/** Canonical values stored on new leads (matches ad ingest labels for ad platforms). */
export const LEAD_SOURCE_OPTIONS = [
  { value: "Website", label: "Website" },
  { value: "Referral", label: "Referral" },
  { value: "Walk In", label: "Walk In" },
  { value: "Facebook Ads", label: "Facebook Ads" },
  { value: "Google Ads", label: "Google Ads" },
  { value: "Cold Call", label: "Cold Call" },
  { value: "Other", label: "Other" },
] as const;

export const LEAD_SOURCE_VALUES = LEAD_SOURCE_OPTIONS.map((option) => option.value);

/** Sentinel value for the advanced filters “All Ad Leads” option. */
export const AD_LEADS_FILTER_VALUE = "__ad_leads__";

export const AD_PLATFORM_SOURCE_OPTIONS = LEAD_SOURCE_OPTIONS.filter((option) =>
  (AD_LEAD_SOURCE_LABELS as readonly string[]).includes(option.value),
);

export const OTHER_LEAD_SOURCE_OPTIONS = LEAD_SOURCE_OPTIONS.filter(
  (option) => !(AD_LEAD_SOURCE_LABELS as readonly string[]).includes(option.value),
);

const LEGACY_TO_CANONICAL: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  "walk-in": "Walk In",
  facebook: "Facebook Ads",
  "google-ads": "Google Ads",
  google: "Google Ads",
  "cold-call": "Cold Call",
  other: "Other",
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
  if (LEAD_SOURCE_VALUES.includes(trimmed as (typeof LEAD_SOURCE_VALUES)[number])) {
    return trimmed;
  }
  return LEGACY_TO_CANONICAL[trimmed.toLowerCase()] ?? trimmed;
}

export function isAdLeadLead(lead: {
  leadSource?: string | null;
  tags?: string[] | null;
}): boolean {
  const source = lead.leadSource?.trim() ?? "";
  if ((AD_LEAD_SOURCE_LABELS as readonly string[]).includes(source)) return true;
  if (LEGACY_TO_CANONICAL[source.toLowerCase()] === "Facebook Ads") return true;
  if (LEGACY_TO_CANONICAL[source.toLowerCase()] === "Google Ads") return true;
  return (lead.tags ?? []).includes(AD_LEAD_TAG);
}

export type AdLeadCustomFields = {
  source?: string;
  externalLeadId?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  adsetId?: string | null;
  adsetName?: string | null;
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
