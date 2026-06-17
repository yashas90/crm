import { passwordHistory, users } from "@propninja/db";
import { desc, eq } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { passwordMatchesHistory, validatePasswordPolicy } from "../lib/passwordPolicy.js";

const HISTORY_LIMIT = 3;

export async function getRecentPasswordHashes(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ passwordHash: passwordHistory.passwordHash })
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))
    .limit(HISTORY_LIMIT);

  return rows.map((row) => row.passwordHash);
}

export type PasswordChangeValidation = { valid: true } | { valid: false; errors: string[] };

export async function validateNewPassword(
  db: Database,
  userId: string,
  newPassword: string,
  currentPasswordHash: string | null,
): Promise<PasswordChangeValidation> {
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return policy;
  }

  const hashes = await getRecentPasswordHashes(db, userId);
  if (currentPasswordHash) {
    hashes.unshift(currentPasswordHash);
  }

  if (await passwordMatchesHistory(newPassword, hashes.slice(0, HISTORY_LIMIT + 1))) {
    return {
      valid: false,
      errors: ["Password cannot be the same as one of your previous passwords."],
    };
  }

  return { valid: true };
}

export async function setUserPassword(
  db: Database,
  userId: string,
  newPassword: string,
  currentPasswordHash: string | null,
): Promise<PasswordChangeValidation> {
  const validation = await validateNewPassword(db, userId, newPassword, currentPasswordHash);
  if (!validation.valid) {
    return validation;
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    if (currentPasswordHash) {
      await tx.insert(passwordHistory).values({
        userId,
        passwordHash: currentPasswordHash,
      });

      const stale = await tx
        .select({ id: passwordHistory.id })
        .from(passwordHistory)
        .where(eq(passwordHistory.userId, userId))
        .orderBy(desc(passwordHistory.createdAt))
        .offset(HISTORY_LIMIT);

      if (stale.length > 0) {
        for (const row of stale) {
          await tx.delete(passwordHistory).where(eq(passwordHistory.id, row.id));
        }
      }
    }

    await tx.update(users).set({ passwordHash, isFirstLogin: false }).where(eq(users.id, userId));
  });

  return { valid: true };
}
