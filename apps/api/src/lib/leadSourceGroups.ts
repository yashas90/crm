import { AD_LEAD_SOURCE_LABELS, type AdLeadSourceLabel } from "./adLeadSources.js";

export type SourceGroupName = "Social" | "Portals" | "Others";

export type SourceCount = {
  name: string;
  count: number;
};

export type SourceGroupReport = {
  sourceGroup: SourceGroupName;
  sources: SourceCount[];
};

const SOCIAL_MATCHERS = [
  "facebook",
  "instagram",
  "linkedin",
  "whatsapp",
  "youtube",
  "twitter",
  "tiktok",
  "telegram",
  "snapchat",
  "pinterest",
  "social",
  "google-ads",
  "google",
];

/** Always shown in dashboard source panels (count 0 when no leads). */
export const CANONICAL_SOCIAL_SOURCES = [
  "Meta Ads",
  "Google Ads",
  "LinkedIn",
  "Gmail",
  "WhatsApp",
  "YouTube",
] as const;

export const CANONICAL_PORTAL_SOURCES = [
  "IVR",
  "Magicbricks",
  "99 Acres",
  "Housing.com",
  "Quikr Homes",
  "Just Dial",
] as const;

export const CANONICAL_OTHER_SOURCES = [
  "Direct",
  "Referral",
  "Walk In",
  "Website",
  "Microsite",
  "Phonebook",
  "Other",
] as const;

const PORTAL_MATCHERS = [
  "99acres",
  "magicbricks",
  "magic-bricks",
  "housing",
  "quikr",
  "quikrhomes",
  "nobroker",
  "proptiger",
  "makaan",
  "squareyards",
  "olx",
  "commonfloor",
  "indiamart",
];

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[\s._]+/g, "-");
}

export function formatSourceName(raw: string) {
  if (!raw.trim()) return "Unknown";
  if ((AD_LEAD_SOURCE_LABELS as readonly string[]).includes(raw.trim())) {
    return raw.trim() as AdLeadSourceLabel;
  }
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function classifySourceGroup(raw: string | null | undefined): SourceGroupName {
  const label = raw?.trim();
  if (!label) return "Others";

  if ((AD_LEAD_SOURCE_LABELS as readonly string[]).includes(label)) {
    return "Social";
  }

  const key = normalizeKey(label);

  if (SOCIAL_MATCHERS.some((matcher) => key.includes(matcher))) {
    return "Social";
  }

  if (PORTAL_MATCHERS.some((matcher) => key.includes(matcher))) {
    return "Portals";
  }

  return "Others";
}

export type LeadsOverTimeRow = {
  date: string;
  count: number;
  sourceGroup: SourceGroupName;
};

export function buildLeadsOverTimeReport(
  rows: { date: string; source: string | null; count: number }[],
): LeadsOverTimeRow[] {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const sourceGroup = classifySourceGroup(row.source);
    const key = `${row.date}\0${sourceGroup}`;
    buckets.set(key, (buckets.get(key) ?? 0) + row.count);
  }

  return [...buckets.entries()]
    .map(([key, count]) => {
      const [date, sourceGroup] = key.split("\0") as [string, SourceGroupName];
      return { date, count, sourceGroup };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.sourceGroup.localeCompare(b.sourceGroup));
}

export function buildSourceGroupReport(
  rows: { source: string | null; count: number }[],
): SourceGroupReport[] {
  const buckets: Record<SourceGroupName, Map<string, number>> = {
    Social: new Map(),
    Portals: new Map(),
    Others: new Map(),
  };

  for (const row of rows) {
    const displayName = formatSourceName(row.source ?? "Unknown");
    const group = classifySourceGroup(row.source);
    const current = buckets[group].get(displayName) ?? 0;
    buckets[group].set(displayName, current + row.count);
  }

  const order: SourceGroupName[] = ["Social", "Portals", "Others"];

  return order.map((sourceGroup) => {
    const sources = [...buckets[sourceGroup].entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const canonical =
      sourceGroup === "Social"
        ? CANONICAL_SOCIAL_SOURCES
        : sourceGroup === "Portals"
          ? CANONICAL_PORTAL_SOURCES
          : CANONICAL_OTHER_SOURCES;

    return { sourceGroup, sources: pinCanonicalSourceBars(sources, canonical) };
  });
}

function pinCanonicalSourceBars(
  sources: SourceCount[],
  canonical: readonly string[],
): SourceCount[] {
  const byName = new Map(sources.map((row) => [row.name, row.count]));
  const canonicalSet = new Set<string>(canonical);
  const pinned = canonical.map((name) => ({
    name,
    count: byName.get(name) ?? 0,
  }));
  const rest = sources.filter((row) => !canonicalSet.has(row.name));

  return [...pinned, ...rest];
}
