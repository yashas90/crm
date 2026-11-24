import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

let client: Redis | null = null;

export function isRedisEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

/** Shared Redis client; null when REDIS_URL is not configured. */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
    // Prefer IPv4/IPv6 as resolved on Railway private network; avoid rapid reconnect storms.
    family: 0,
    keepAlive: 10_000,
    connectTimeout: 10_000,
    retryStrategy(times) {
      // Cap backoff at 30s so a flaky Redis does not pin the event loop.
      return Math.min(times * 250, 30_000);
    },
  });

  client.on("error", (error: Error) => {
    // Downgrade noisy reconnect races; still surface unexpected errors.
    if (error.message.includes("already connecting/connected")) return;
    logger.error("Redis client error", { message: error.message });
  });

  client.on("close", () => {
    logger.warn("Redis connection closed — will reconnect automatically");
  });

  client.on("reconnecting", (delay: number) => {
    if (delay < 1_000) return;
    logger.warn("Redis reconnecting", { delayMs: delay });
  });

  client.on("connect", () => {
    logger.info("Redis connected");
  });

  return client;
}

/** Close the shared client (tests / graceful shutdown). */
export async function closeRedis(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  await current.quit().catch(() => current.disconnect());
}
