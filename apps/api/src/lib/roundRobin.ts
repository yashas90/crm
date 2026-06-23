/** Pick an agent id for a zero-based row/index using round-robin. */
export function agentForRoundRobinIndex(agentIds: string[], index: number): string {
  if (agentIds.length === 0) {
    throw new Error("At least one agent is required");
  }
  return agentIds[index % agentIds.length]!;
}
