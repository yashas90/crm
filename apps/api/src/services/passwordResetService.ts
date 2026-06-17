import { passwordResetTokens, users } from "@propninja/db";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "../lib/resendEmail.js";
import { setUserPassword } from "./passwordHistoryService.js";
import { revokeAllUserSessions } from "./tokenRevocationService.js";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export type PasswordResetTokenValidation =
  | { valid: true; email: string; userId: string; tokenId: string }
  | { valid: false; reason: "not_found" | "used" | "expired" | "inactive" };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function passwordResetExpiresAt(from = new Date()) {
  return new Date(from.getTime() + TOKEN_TTL_MS);
}

export function isPasswordResetTokenExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export async function createPasswordResetToken(userId: string, now = new Date()) {
  const db = getDb();
  const token = crypto.randomUUID();
  const expiresAt = passwordResetExpiresAt(now);

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  const [row] = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      token,
      expiresAt,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create password reset token");
  }

  return row;
}

export async function requestPasswordReset(email: string) {
  const normalized = normalizeEmail(email);
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      isActive: users.isActive,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!user?.isActive || !user.passwordHash) {
    return;
  }

  const tokenRow = await createPasswordResetToken(user.id);
  const resetUrl = buildPasswordResetUrl(tokenRow.token);
  await sendPasswordResetEmail({ to: user.email, resetUrl });
}

export async function validatePasswordResetToken(
  token: string,
  now = new Date(),
): Promise<PasswordResetTokenValidation> {
  const db = getDb();
  const [row] = await db
    .select({
      tokenId: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      email: users.email,
      isActive: users.isActive,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!row) {
    return { valid: false, reason: "not_found" };
  }
  if (row.usedAt) {
    return { valid: false, reason: "used" };
  }
  if (isPasswordResetTokenExpired(row.expiresAt, now)) {
    return { valid: false, reason: "expired" };
  }
  if (!row.isActive) {
    return { valid: false, reason: "inactive" };
  }

  return {
    valid: true,
    email: row.email,
    userId: row.userId,
    tokenId: row.tokenId,
  };
}

export async function completePasswordReset(token: string, newPassword: string, now = new Date()) {
  const validation = await validatePasswordResetToken(token, now);
  if (!validation.valid) {
    return validation;
  }

  const db = getDb();

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, validation.userId))
    .limit(1);

  const passwordResult = await setUserPassword(
    db,
    validation.userId,
    newPassword,
    user?.passwordHash ?? null,
  );

  if (!passwordResult.valid) {
    return passwordResult;
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: passwordResetTokens.id,
        usedAt: passwordResetTokens.usedAt,
        expiresAt: passwordResetTokens.expiresAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    if (!current || current.usedAt || isPasswordResetTokenExpired(current.expiresAt, now)) {
      throw new Error("TOKEN_INVALID");
    }

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, validation.tokenId));
  });

  await revokeAllUserSessions(validation.userId);

  return { valid: true as const };
}

/** Marks expired unused tokens as used so they cannot be revived. */
export async function expireStalePasswordResetTokens(now = new Date()) {
  const db = getDb();
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(isNull(passwordResetTokens.usedAt), lt(passwordResetTokens.expiresAt, now)));
}
