/**
 * Agents may keep a lead on themselves or hand it back to an active admin only.
 */
import { users } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import type { AuthUser } from "../middleware/auth.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";

export const AGENT_ASSIGN_ADMIN_ONLY_MESSAGE = "Agents can only reassign leads back to an admin";

export async function assertAgentAssigneeAllowed(
  authUser: AuthUser,
  assigneeId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (authUser.role !== "agent") return { ok: true };
  if (!assigneeId || assigneeId === authUser.id) return { ok: true };

  const [assignee] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, assigneeId), eq(users.orgId, SINGLE_TENANT_ORG_ID)))
    .limit(1);

  if (!assignee?.isActive || assignee.role !== "admin") {
    return { ok: false, message: AGENT_ASSIGN_ADMIN_ONLY_MESSAGE };
  }

  return { ok: true };
}

export async function assertAgentAssigneesAllowed(
  authUser: AuthUser,
  assigneeIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const id of assigneeIds) {
    const result = await assertAgentAssigneeAllowed(authUser, id);
    if (!result.ok) return result;
  }
  return { ok: true };
}
