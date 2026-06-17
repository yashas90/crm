export const HOT_LEAD_SCORE_THRESHOLD = 70;
export const WARM_LEAD_SCORE_THRESHOLD = 40;

export function scoreTier(score: number): "hot" | "warm" | "cold" {
  if (score >= HOT_LEAD_SCORE_THRESHOLD) return "hot";
  if (score >= WARM_LEAD_SCORE_THRESHOLD) return "warm";
  return "cold";
}
