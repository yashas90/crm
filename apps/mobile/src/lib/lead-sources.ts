/** Canonical / portal source labels used in filters and list badges. */
export const LEAD_SOURCE_FILTER_CHIPS = [
  { value: "", label: "Any source" },
  { value: "Meta Ads", label: "Meta" },
  { value: "Google Ads", label: "Google Ads" },
  { value: "99 Acres", label: "99 Acres" },
  { value: "Magicbricks", label: "MagicBricks" },
  { value: "Housing.com", label: "Housing" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Website", label: "Website" },
  { value: "Referral", label: "Referral" },
  { value: "Walk In", label: "Walk In" },
  { value: "Cold Call", label: "Cold Call" },
  { value: "Other", label: "Other" },
] as const;

const LEGACY_TO_CANONICAL: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  "walk-in": "Walk In",
  facebook: "Meta Ads",
  "facebook ads": "Meta Ads",
  "meta ads": "Meta Ads",
  meta: "Meta Ads",
  fb: "Meta Ads",
  "google-ads": "Google Ads",
  google: "Google Ads",
  "cold-call": "Cold Call",
  cold_call: "Cold Call",
  "99acres": "99 Acres",
  "99 acres": "99 Acres",
  magicbricks: "Magicbricks",
  housing: "Housing.com",
  other: "Other",
};

/** Display label for any stored lead_source (canonical or legacy slug). */
export function formatLeadSourceDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (trimmed === "Facebook Ads") return "Meta Ads";
  const legacy = LEGACY_TO_CANONICAL[trimmed.toLowerCase()];
  if (legacy) return legacy;
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function isMetaLeadSource(source: string | null | undefined): boolean {
  if (!source) return false;
  const normalized = source.trim().toLowerCase();
  return normalized.includes("meta") || normalized.includes("facebook") || normalized === "fb";
}
