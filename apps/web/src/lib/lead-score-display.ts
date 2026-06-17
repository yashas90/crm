export type ScoreTier = "hot" | "warm" | "cold";

export function scoreTierLabel(tier: ScoreTier): string {
  switch (tier) {
    case "hot":
      return "Hot";
    case "warm":
      return "Warm";
    default:
      return "Cold";
  }
}

export function scoreBadgeClass(tier: ScoreTier): string {
  switch (tier) {
    case "hot":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "warm":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function formatScoreFactor(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}
