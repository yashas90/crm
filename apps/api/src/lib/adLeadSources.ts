/** Canonical lead_source values written by adLeadService.ingestAdLead. */
export const AD_LEAD_SOURCE_LABELS = ["Facebook Ads", "Google Ads"] as const;

export type AdLeadSourceLabel = (typeof AD_LEAD_SOURCE_LABELS)[number];

export const AD_LEAD_TAG = "ad_lead";

export const AD_LEAD_PLATFORM_TAGS = ["facebook_ads", "google_ads"] as const;
