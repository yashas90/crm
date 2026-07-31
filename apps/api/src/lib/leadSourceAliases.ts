import { AD_LEAD_SOURCE_LABELS } from "./adLeadSources.js";

/** Canonical label → legacy stored values still present in older leads. */
const SOURCE_ALIAS_GROUPS: Record<string, readonly string[]> = {
  "Meta Ads": [
    "Meta Ads",
    "Facebook Ads",
    "facebook",
    "Facebook",
    "Facebook / Meta",
    "Meta",
    "fb",
    "FB",
    "meta ads",
    "facebook ads",
  ],
  "Google Ads": ["Google Ads", "google-ads", "google", "Google", "GoogleAds"],
  Website: ["Website", "website"],
  Referral: ["Referral", "referral"],
  "Walk In": ["Walk In", "walk-in", "Walk-In", "walkin"],
  "Cold Call": ["Cold Call", "cold-call", "cold_call", "ColdCall"],
  Other: ["Other", "other"],
  Magicbricks: ["Magicbricks", "MagicBricks", "Magic Bricks", "magicbricks"],
  "99 Acres": ["99 Acres", "99acres", "99Acres"],
  "Housing.com": ["Housing.com", "Housing", "housing.com", "housing"],
  WhatsApp: ["WhatsApp", "Whatsapp", "whatsapp", "WHATSAPP"],
};

/** Expand a filter value to every stored variant (canonical + legacy slugs). */
export function expandLeadSourceFilter(source: string): string[] {
  const trimmed = source.trim();
  if (!trimmed) return [];

  // Direct canonical match
  if (SOURCE_ALIAS_GROUPS[trimmed]) {
    return [...SOURCE_ALIAS_GROUPS[trimmed]!];
  }

  // Case-insensitive lookup across all aliases
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [canonical, aliases] of Object.entries(SOURCE_ALIAS_GROUPS)) {
    if (aliases.some((a) => a.toLowerCase() === lowerTrimmed)) {
      return [...SOURCE_ALIAS_GROUPS[canonical]!];
    }
  }

  return [trimmed];
}

/**
 * Returns the canonical source label for any stored or user-supplied value.
 * Falls back to the trimmed original if no alias matches.
 */
export function canonicalizeLeadSource(source: string | null | undefined): string | null {
  if (!source?.trim()) return null;
  const trimmed = source.trim();
  if (SOURCE_ALIAS_GROUPS[trimmed]) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const [canonical, aliases] of Object.entries(SOURCE_ALIAS_GROUPS)) {
    if (aliases.some((a) => a.toLowerCase() === lower)) return canonical;
  }
  return trimmed;
}

export function isAdLeadSourceLabel(source: string) {
  return (AD_LEAD_SOURCE_LABELS as readonly string[]).includes(source.trim());
}

/** Lowercased unique variants for case-insensitive SQL `IN` filters. */
export function leadSourceLowerVariants(source: string): string[] {
  return [...new Set(expandLeadSourceFilter(source).map((v) => v.toLowerCase()))];
}
