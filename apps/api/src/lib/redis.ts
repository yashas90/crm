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
  });

  client.on("error", (error: Error) => {
    logger.error("Redis client error", { message: error.message });
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
