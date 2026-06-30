import { createHash, randomBytes } from "node:crypto";
import { authRefreshSessions, users } from "@propninja/db";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import { parseDurationToMs } from "../lib/duration.js";
import { env } from "../lib/env.js";

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createRefreshSession(
  db: Database,
  input: {
    userId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  },
): Promise<string> {
  const token = generateRefreshToken();
  await db.insert(authRefreshSessions).values({
    userId: input.userId,
    tokenHash: hashRefreshToken(token),
    expiresAt: refreshExpiresAt(),
    userAgent: input.userAgent ?? null,
    ipAddress: input.ipAddress ?? null,
  });
  return token;
}

export type ValidRefreshSession = {
  sessionId: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: "admin" | "manager" | "agent";
    isActive: boolean;
  };
};

export async function validateRefreshToken(
  db: Database,
  token: string,
): Promise<ValidRefreshSession | null> {
  const tokenHash = hashRefreshToken(token);
  const [session] = await db
    .select({
      sessionId: authRefreshSessions.id,
      userId: authRefreshSessions.userId,
      expiresAt: authRefreshSessions.expiresAt,
      revokedAt: authRefreshSessions.revokedAt,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
    })
    .from(authRefreshSessions)
    .innerJoin(users, eq(authRefreshSessions.userId, users.id))
    .where(and(eq(authRefreshSessions.tokenHash, tokenHash), isNull(authRefreshSessions.revokedAt)))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.isActive) return null;

  const role = session.role;
  if (role !== "admin" && role !== "manager" && role !== "agent") return null;

  return {
    sessionId: session.sessionId,
    userId: session.userId,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role,
      isActive: session.isActive,
    },
  };
}

/** Rotate refresh token — revoke old session and issue a new one. */
export async function rotateRefreshSession(
  db: Database,
  sessionId: string,
  userId: string,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
): Promise<string> {
  await db
    .update(authRefreshSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authRefreshSessions.id, sessionId));

  return createRefreshSession(db, { userId, ...meta });
}

export async function revokeRefreshToken(db: Database, token: string): Promise<void> {
  const tokenHash = hashRefreshToken(token);
  await db
    .update(authRefreshSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authRefreshSessions.tokenHash, tokenHash));
}

export async function revokeAllRefreshSessions(db: Database, userId: string): Promise<void> {
  await db
    .update(authRefreshSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authRefreshSessions.userId, userId), isNull(authRefreshSessions.revokedAt)));
}

/** Remove expired and long-revoked refresh sessions (housekeeping). */
export async function purgeExpiredRefreshSessions(db: Database): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const removed = await db
    .delete(authRefreshSessions)
    .where(
      or(
        lt(authRefreshSessions.expiresAt, new Date()),
        and(isNotNull(authRefreshSessions.revokedAt), lt(authRefreshSessions.revokedAt, cutoff)),
      ),
    )
    .returning({ id: authRefreshSessions.id });
  return removed.length;
}
