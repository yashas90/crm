import { users } from "@propninja/db";
import { and, eq, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import type { Database } from "./db.js";
import { badRequest } from "./errors.js";

export const LAST_ADMIN_MESSAGE =
  "Cannot remove the last admin account. Create another admin first.";

export async function countActiveAdmins(db: Database): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.role, "admin"), eq(users.isActive, true)),
    );

  return Number(count ?? 0);
}

export function isRemovingAdminPrivileges(
  existing: { role: string; isActive: boolean },
  payload: { role?: string; isActive?: boolean },
): boolean {
  if (existing.role !== "admin" || !existing.isActive) {
    return false;
  }

  if (payload.role !== undefined && payload.role !== "admin") {
    return true;
  }

  if (payload.isActive === false) {
    return true;
  }

  return false;
}

export async function assertCanRemoveAdminPrivileges(
  db: Database,
  existing: { role: string; isActive: boolean },
  payload: { role?: string; isActive?: boolean },
): Promise<void> {
  if (!isRemovingAdminPrivileges(existing, payload)) {
    return;
  }

  const activeAdminCount = await countActiveAdmins(db);
  if (activeAdminCount <= 1) {
    throw badRequest(LAST_ADMIN_MESSAGE, undefined, "LAST_ADMIN");
  }
}

export function isLastActiveAdmin(
  user: { role: string; isActive: boolean },
  activeAdminCount: number,
): boolean {
  return user.role === "admin" && user.isActive && activeAdminCount === 1;
}
