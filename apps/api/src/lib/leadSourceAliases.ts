import { AD_LEAD_SOURCE_LABELS } from "./adLeadSources.js";

/** Canonical label → legacy stored values still present in older leads. */
const SOURCE_ALIAS_GROUPS: Record<string, readonly string[]> = {
  "Meta Ads": ["Meta Ads", "Facebook Ads", "facebook"],
  "Google Ads": ["Google Ads", "google-ads", "google"],
  Website: ["Website", "website"],
  Referral: ["Referral", "referral"],
  "Walk In": ["Walk In", "walk-in"],
  "Cold Call": ["Cold Call", "cold-call"],
  Other: ["Other", "other"],
};

const aliasToCanonical = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(SOURCE_ALIAS_GROUPS)) {
  for (const alias of aliases) {
    aliasToCanonical.set(alias.toLowerCase(), canonical);
  }
}

/** Expand a filter value to every stored variant (canonical + legacy slugs). */
export function expandLeadSourceFilter(source: string): string[] {
  const trimmed = source.trim();
  if (!trimmed) return [];

  const canonical = aliasToCanonical.get(trimmed.toLowerCase());
  if (canonical && SOURCE_ALIAS_GROUPS[canonical]) {
    return [...SOURCE_ALIAS_GROUPS[canonical]];
  }

  return [trimmed];
}

export function isAdLeadSourceLabel(source: string) {
  return (AD_LEAD_SOURCE_LABELS as readonly string[]).includes(source.trim());
}
