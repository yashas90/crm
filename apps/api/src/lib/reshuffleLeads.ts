export type ReshuffleLead = {
  id: string;
  assignedTo: string | null;
};

export type ReshuffleAssignment = {
  leadId: string;
  userId: string;
};

export type ReshuffleSkip = {
  id: string;
  message: string;
};

/**
 * Spread leads across the pool. A lead never stays with its current agent.
 * The cursor walks the pool so successive leads do not all land on one person.
 */
export function planReshuffle(
  rows: ReshuffleLead[],
  userIds: string[],
): { assignments: ReshuffleAssignment[]; skipped: ReshuffleSkip[] } {
  const pool = [...new Set(userIds)];
  const assignments: ReshuffleAssignment[] = [];
  const skipped: ReshuffleSkip[] = [];

  if (pool.length === 0) {
    return {
      assignments,
      skipped: rows.map((row) => ({
        id: row.id,
        message: "Choose at least two agents",
      })),
    };
  }

  let cursor = 0;
  for (const row of rows) {
    let chosen: string | null = null;
    for (let step = 0; step < pool.length; step++) {
      const candidate = pool[(cursor + step) % pool.length]!;
      if (candidate === row.assignedTo) continue;
      chosen = candidate;
      cursor = (cursor + step + 1) % pool.length;
      break;
    }

    if (!chosen) {
      skipped.push({
        id: row.id,
        message: "No other agent is available for this lead",
      });
      continue;
    }

    assignments.push({ leadId: row.id, userId: chosen });
  }

  return { assignments, skipped };
}
