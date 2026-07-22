/**
 * Resolve assignee for a Meta lead form mapping (LeadRat-style).
 * Prefers form assigneeIds with round-robin / first; returns null to fall back to global rules.
 */
import { facebookForms } from "@propninja/db";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../lib/db.js";

export async function pickMetaFormAssignee(
  orgId: string,
  metaFormId: string | undefined | null,
): Promise<string | null> {
  if (!metaFormId?.trim()) return null;

  const [form] = await db
    .select({
      id: facebookForms.id,
      assigneeIds: facebookForms.assigneeIds,
      assignmentStrategy: facebookForms.assignmentStrategy,
      lastAssignedIndex: facebookForms.lastAssignedIndex,
    })
    .from(facebookForms)
    .where(and(eq(facebookForms.orgId, orgId), eq(facebookForms.formId, metaFormId)))
    .limit(1);

  const assignees = (form?.assigneeIds ?? []).filter(Boolean);
  if (!form || assignees.length === 0) return null;

  if (form.assignmentStrategy === "first" || assignees.length === 1) {
    return assignees[0] ?? null;
  }

  // Atomic round-robin: bump index then read selected assignee.
  const [updated] = await db
    .update(facebookForms)
    .set({
      lastAssignedIndex: sql`(${facebookForms.lastAssignedIndex} + 1) % ${assignees.length}`,
      updatedAt: new Date(),
    })
    .where(eq(facebookForms.id, form.id))
    .returning({ lastAssignedIndex: facebookForms.lastAssignedIndex });

  const idx = updated?.lastAssignedIndex ?? 0;
  return assignees[idx] ?? assignees[0] ?? null;
}
