import type { AgentStats } from "@/hooks/use-agent-stats";

export function buildPerformanceShareText(stats: AgentStats): string {
  const monthLabel = new Date().toLocaleString(undefined, { month: "long", year: "numeric" });
  const m = stats.thisMonth;
  return [
    `PropNinja Performance — ${monthLabel}`,
    `Calls: ${m.totalCalls} | Answered: ${m.answeredPercent}% | Won: ${m.leadsConverted} leads`,
  ].join("\n");
}
