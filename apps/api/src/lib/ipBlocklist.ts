import { getRedis, isRedisEnabled } from "./redis.js";

const MEMORY_BLOCKS = new Map<string, number>();
const REDIS_PREFIX = "ipblock:";
const ONE_HOUR_MS = 60 * 60 * 1000;

function memoryBlock(ip: string, durationMs: number) {
  MEMORY_BLOCKS.set(ip, Date.now() + durationMs);
}

function memoryIsBlocked(ip: string): boolean {
  const until = MEMORY_BLOCKS.get(ip);
  if (!until) return false;
  if (Date.now() >= until) {
    MEMORY_BLOCKS.delete(ip);
    return false;
  }
  return true;
}

export async function blockIp(ip: string, durationMs = ONE_HOUR_MS): Promise<void> {
  memoryBlock(ip, durationMs);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`${REDIS_PREFIX}${ip}`, String(Date.now() + durationMs), "PX", durationMs);
  } catch {
    // Fall back to in-memory only.
  }
}

/** Sync wrapper for hot paths that cannot await (legacy callers). */
export function blockIpSync(ip: string, durationMs = ONE_HOUR_MS): void {
  void blockIp(ip, durationMs);
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (memoryIsBlocked(ip)) return true;
  const redis = getRedis();
  if (!redis) return false;
  try {
    const value = await redis.get(`${REDIS_PREFIX}${ip}`);
    if (!value) return false;
    const until = Number(value);
    if (!Number.isFinite(until) || Date.now() >= until) {
      await redis.del(`${REDIS_PREFIX}${ip}`);
      return false;
    }
    memoryBlock(ip, until - Date.now());
    return true;
  } catch {
    return memoryIsBlocked(ip);
  }
}

/** Sync check — memory cache only (used before Redis warms). */
export function isIpBlockedSync(ip: string): boolean {
  return memoryIsBlocked(ip);
}

export async function unblockIp(ip: string): Promise<void> {
  MEMORY_BLOCKS.delete(ip);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`${REDIS_PREFIX}${ip}`);
  } catch {
    // Fall back to in-memory only.
  }
}

/** Clear stale auto-blocks after policy changes (e.g. shared office NAT). */
export async function clearAllIpBlocks(): Promise<number> {
  const clearedMemory = MEMORY_BLOCKS.size;
  MEMORY_BLOCKS.clear();

  const redis = getRedis();
  if (!redis) return clearedMemory;

  let clearedRedis = 0;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${REDIS_PREFIX}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        clearedRedis += keys.length;
      }
    } while (cursor !== "0");
  } catch {
    return clearedMemory;
  }

  return clearedMemory + clearedRedis;
}

export function clearExpiredIpBlocks(): void {
  const now = Date.now();
  for (const [ip, until] of MEMORY_BLOCKS) {
    if (now >= until) MEMORY_BLOCKS.delete(ip);
  }
}

export function getIpBlockExpiry(ip: string): number | undefined {
  return MEMORY_BLOCKS.get(ip);
}

export function isDistributedIpBlocklistEnabled(): boolean {
  return isRedisEnabled();
}
