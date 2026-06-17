import { tokenBlocklist, users } from "@propninja/db";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { blockedJtis, revokedUsers, sessionRevokedAfter } from "../lib/tokenBlocklist.js";

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const db = getDb();
  const now = new Date();

  await db.update(users).set({ sessionsRevokedAt: now }).where(eq(users.id, userId));

  revokedUsers.add(userId);
  sessionRevokedAfter.set(userId, Math.floor(now.getTime() / 1000));
}

export async function addTokenToBlocklist(input: {
  jti: string;
  userId: string;
  expiresAt: Date;
  reason: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(tokenBlocklist).values({
    jti: input.jti,
    userId: input.userId,
    expiresAt: input.expiresAt,
    reason: input.reason,
  });
  blockedJtis.add(input.jti);
}
