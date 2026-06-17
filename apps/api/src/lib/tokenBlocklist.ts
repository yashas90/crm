import { tokenBlocklist, users } from "@propninja/db";
import { and, gt, isNotNull } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";

const REFRESH_INTERVAL_MS = 60_000;

/** Individual revoked JWT IDs — checked after revoked-user session cutoff. */
export const blockedJtis = new Set<string>();

/** Users with a bulk session revocation — checked first for performance. */
export const revokedUsers = new Set<string>();

/** Token `iat` (seconds) must be strictly after this to remain valid after bulk revoke. */
export const sessionRevokedAfter = new Map<string, number>();

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function isJtiBlocked(jti: string): boolean {
  return blockedJtis.has(jti);
}

export function isUserSessionRevoked(userId: string, tokenIssuedAtSec: number): boolean {
  if (!revokedUsers.has(userId)) return false;
  const cutoff = sessionRevokedAfter.get(userId);
  if (cutoff === undefined) return false;
  return tokenIssuedAtSec <= cutoff;
}

export async function refreshTokenBlocklistCache(): Promise<void> {
  const db = getDb();
  const now = new Date();

  try {
    const [jtis, revokedRows] = await Promise.all([
      db
        .select({ jti: tokenBlocklist.jti })
        .from(tokenBlocklist)
        .where(gt(tokenBlocklist.expiresAt, now)),
      db
        .select({
          id: users.id,
          sessionsRevokedAt: users.sessionsRevokedAt,
        })
        .from(users)
        .where(isNotNull(users.sessionsRevokedAt)),
    ]);

    blockedJtis.clear();
    for (const row of jtis) {
      blockedJtis.add(row.jti);
    }

    revokedUsers.clear();
    sessionRevokedAfter.clear();
    for (const row of revokedRows) {
      if (!row.sessionsRevokedAt) continue;
      revokedUsers.add(row.id);
      sessionRevokedAfter.set(row.id, Math.floor(row.sessionsRevokedAt.getTime() / 1000));
    }
  } catch (error) {
    logger.error("Failed to refresh token blocklist cache", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startTokenBlocklistRefresh(): void {
  if (refreshTimer) return;
  void refreshTokenBlocklistCache();
  refreshTimer = setInterval(() => {
    void refreshTokenBlocklistCache();
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref?.();
}

export function stopTokenBlocklistRefreshForTests(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  blockedJtis.clear();
  revokedUsers.clear();
  sessionRevokedAfter.clear();
}
