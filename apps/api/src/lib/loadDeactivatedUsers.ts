import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { blockUser } from "../lib/deactivatedUsers.js";
import { logger } from "../lib/logger.js";

/** Load inactive user IDs into the in-process blocklist at startup. */
export async function loadDeactivatedUsersBlocklist(): Promise<number> {
  try {
    const db = getDb();
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.isActive, false));

    for (const row of rows) {
      blockUser(row.id);
    }

    logger.info("Deactivated user blocklist loaded", { count: rows.length });
    return rows.length;
  } catch (error) {
    logger.error("Failed to load deactivated user blocklist", {
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
