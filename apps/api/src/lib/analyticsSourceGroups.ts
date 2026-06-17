export type AnalyticsSourceBucket = "Meta" | "Google" | "Manual" | "CSV" | "Referral";

const ORDERED_BUCKETS: AnalyticsSourceBucket[] = ["Meta", "Google", "Manual", "CSV", "Referral"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function categorizeAnalyticsSource(sourceName: string): AnalyticsSourceBucket {
  const n = normalize(sourceName);

  if (n.includes("referral")) return "Referral";
  if (n.includes("google")) return "Google";
  if (
    n.includes("facebook") ||
    n.includes("instagram") ||
    n.includes("whatsapp") ||
    n.includes("meta")
  ) {
    return "Meta";
  }
  if (
    n.includes("bulk_import") ||
    (n.includes("csv") && n.includes("import")) ||
    (n.includes("bulk") && n.includes("import"))
  ) {
    return "CSV";
  }

  return "Manual";
}

export function buildAnalyticsSourceCounts(
  rows: { source: string | null; count: number }[],
): { source: AnalyticsSourceBucket; count: number }[] {
  const totals: Record<AnalyticsSourceBucket, number> = {
    Meta: 0,
    Google: 0,
    Manual: 0,
    CSV: 0,
    Referral: 0,
  };

  for (const row of rows) {
    totals[categorizeAnalyticsSource(row.source ?? "Manual")] += row.count;
  }

  return ORDERED_BUCKETS.map((source) => ({ source, count: totals[source] }));
}
