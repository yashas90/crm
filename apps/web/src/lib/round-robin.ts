/** Pick an agent id for a zero-based row/index using round-robin. */
export function agentForRoundRobinIndex(agentIds: string[], index: number): string {
  if (agentIds.length === 0) {
    throw new Error("At least one agent is required");
  }
  return agentIds[index % agentIds.length]!;
}

export function roundRobinDistributionLabel(agentIds: string[], itemCount: number): string {
  if (agentIds.length === 0 || itemCount === 0) return "";
  if (agentIds.length === 1) return "All to the selected agent";
  const perAgent = Math.floor(itemCount / agentIds.length);
  const remainder = itemCount % agentIds.length;
  if (remainder === 0) {
    return `~${perAgent} each across ${agentIds.length} agents (round-robin)`;
  }
  return `Split across ${agentIds.length} agents (round-robin)`;
}
