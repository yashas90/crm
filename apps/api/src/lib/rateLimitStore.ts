import { logger } from "./logger.js";
import { getRedis, isRedisEnabled } from "./redis.js";

const INCR_WITH_EXPIRE_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export interface RateLimitBackend {
  increment(key: string, windowSec: number): Promise<number>;
}

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();

class MemoryRateLimitBackend implements RateLimitBackend {
  increment(key: string, windowSec: number): Promise<number> {
    const windowMs = windowSec * 1000;
    const now = Date.now();
    let bucket = memoryBuckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      memoryBuckets.set(key, bucket);
    }

    bucket.count += 1;
    return Promise.resolve(bucket.count);
  }
}

class RedisRateLimitBackend implements RateLimitBackend {
  async increment(key: string, windowSec: number): Promise<number> {
    const redis = getRedis();
    if (!redis) {
      return memoryFallback.increment(key, windowSec);
    }

    try {
      if (redis.status !== "ready") {
        await redis.connect();
      }
      const result = await redis.eval(INCR_WITH_EXPIRE_SCRIPT, 1, key, String(windowSec));
      return Number(result);
    } catch (error) {
      logger.error("Redis rate limit increment failed; allowing request", {
        key,
        message: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

const memoryFallback = new MemoryRateLimitBackend();

let backend: RateLimitBackend | null = null;

export function getRateLimitBackend(): RateLimitBackend {
  if (!backend) {
    backend = isRedisEnabled() ? new RedisRateLimitBackend() : new MemoryRateLimitBackend();
  }
  return backend;
}

/** @internal Test helper — reset in-memory state and backend selection. */
export function resetRateLimitStoreForTests(): void {
  memoryBuckets.clear();
  backend = null;
}

/** Clear all in-memory rate-limit counters (e.g. after false-positive office NAT blocks). */
export function clearAllRateLimits(): number {
  const cleared = memoryBuckets.size;
  memoryBuckets.clear();
  return cleared;
}

export async function incrementRateLimit(
  key: string,
  windowMs: number,
  store: RateLimitBackend = getRateLimitBackend(),
): Promise<number> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  return store.increment(key, windowSec);
}
