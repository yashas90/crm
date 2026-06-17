import { leadAssignments, users } from "@propninja/db";
import { desc, eq, inArray } from "drizzle-orm";
import { type Database, db } from "../lib/db.js";

export type LeadAssignmentHistoryItem = {
  id: string;
  leadId: string;
  fromAgentId: string | null;
  fromAgentName: string | null;
  toAgentId: string;
  toAgentName: string;
  assignedBy: string;
  assignedByName: string;
  reason: string | null;
  assignedAt: string;
};

type DbExecutor = Pick<Database, "insert" | "select">;

export async function recordLeadAssignment(
  executor: DbExecutor,
  input: {
    leadId: string;
    fromAgentId: string | null;
    toAgentId: string;
    assignedBy: string;
    reason?: string | null;
  },
) {
  const [row] = await executor
    .insert(leadAssignments)
    .values({
      leadId: input.leadId,
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      assignedBy: input.assignedBy,
      reason: input.reason?.trim() || null,
    })
    .returning();

  return row ?? null;
}

export async function getAssignmentHistory(leadId: string): Promise<LeadAssignmentHistoryItem[]> {
  const rows = await db
    .select()
    .from(leadAssignments)
    .where(eq(leadAssignments.leadId, leadId))
    .orderBy(desc(leadAssignments.assignedAt));

  if (rows.length === 0) {
    return [];
  }

  const userIds = new Set<string>();
  for (const row of rows) {
    if (row.fromAgentId) userIds.add(row.fromAgentId);
    userIds.add(row.toAgentId);
    userIds.add(row.assignedBy);
  }

  const nameRows =
    userIds.size > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, [...userIds]))
      : [];

  const nameById = new Map(nameRows.map((row) => [row.id, row.name]));

  return rows.map((row) => ({
    id: row.id,
    leadId: row.leadId,
    fromAgentId: row.fromAgentId,
    fromAgentName: row.fromAgentId ? (nameById.get(row.fromAgentId) ?? null) : null,
    toAgentId: row.toAgentId,
    toAgentName: nameById.get(row.toAgentId) ?? "Unknown",
    assignedBy: row.assignedBy,
    assignedByName: nameById.get(row.assignedBy) ?? "Unknown",
    reason: row.reason,
    assignedAt: row.assignedAt.toISOString(),
  }));
}

export async function getLatestAssignment(
  leadId: string,
): Promise<LeadAssignmentHistoryItem | null> {
  const [latest] = await getAssignmentHistory(leadId);
  return latest ?? null;
}
