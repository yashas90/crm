export const HOT_LEAD_SCORE_THRESHOLD = 70;
export const WARM_LEAD_SCORE_THRESHOLD = 40;

export function scoreTier(score: number): "hot" | "warm" | "cold" {
  if (score >= HOT_LEAD_SCORE_THRESHOLD) return "hot";
  if (score >= WARM_LEAD_SCORE_THRESHOLD) return "warm";
  return "cold";
}

export function scoreBadgeStyle(score: number) {
  const tier = scoreTier(score);
  if (tier === "hot") {
    return { bg: "rgba(16, 185, 129, 0.15)", text: "#047857", label: "Hot" };
  }
  if (tier === "warm") {
    return { bg: "rgba(249, 115, 22, 0.15)", text: "#C2410C", label: "Warm" };
  }
  return { bg: "rgba(148, 163, 184, 0.2)", text: "#64748B", label: "Cold" };
}
