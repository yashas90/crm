import { loginEvents } from "@propninja/db";
import { and, desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { getClientIp } from "../lib/clientIp.js";
import type { Database } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { sendPushNotification } from "../lib/pushNotifications.js";

export type LoginDevice = "mobile" | "web";

export type LoginEventRecord = {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  device: LoginDevice;
  locationCity: string | null;
  locationCountry: string | null;
  isNewDevice: boolean;
  createdAt: Date;
};

export function detectLoginDevice(userAgent: string | null | undefined): LoginDevice {
  const ua = (userAgent ?? "").toLowerCase();
  if (
    ua.includes("expo") ||
    ua.includes("reactnative") ||
    ua.includes("okhttp") ||
    ua.includes("cfnetwork") ||
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ipad")
  ) {
    return "mobile";
  }
  return "web";
}

type GeoResult = { city: string | null; country: string | null };

async function lookupIpGeolocation(ip: string | null): Promise<GeoResult> {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip === "::1") {
    return { city: null, country: null };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return { city: null, country: null };
    const data = (await response.json()) as { status?: string; city?: string; country?: string };
    if (data.status !== "success") return { city: null, country: null };
    return { city: data.city ?? null, country: data.country ?? null };
  } catch (error) {
    logger.warn("IP geolocation lookup failed", {
      ip,
      message: error instanceof Error ? error.message : String(error),
    });
    return { city: null, country: null };
  }
}

async function isNewLoginFingerprint(
  db: Database,
  userId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<boolean> {
  const conditions = [eq(loginEvents.userId, userId)];
  if (ip) {
    conditions.push(eq(loginEvents.ipAddress, ip));
  }
  if (userAgent) {
    conditions.push(eq(loginEvents.userAgent, userAgent));
  }

  const prior = await db
    .select({ id: loginEvents.id })
    .from(loginEvents)
    .where(and(...conditions))
    .limit(1);

  return prior.length === 0;
}

export async function recordSuccessfulLogin(
  c: Context,
  db: Database,
  userId: string,
): Promise<LoginEventRecord> {
  const ip = getClientIp(c);
  const userAgent = c.req.header("user-agent") ?? null;
  const device = detectLoginDevice(userAgent);
  const geo = await lookupIpGeolocation(ip);
  const isNewDevice = await isNewLoginFingerprint(db, userId, ip, userAgent);

  const [row] = await db
    .insert(loginEvents)
    .values({
      userId,
      ipAddress: ip,
      userAgent,
      device,
      locationCity: geo.city,
      locationCountry: geo.country,
      isNewDevice,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to record login event");
  }

  if (isNewDevice) {
    const locationLabel =
      geo.city && geo.country
        ? `${geo.city}, ${geo.country}`
        : (geo.country ?? ip ?? "unknown location");
    void sendPushNotification(
      db,
      userId,
      "New sign-in detected",
      `Your account was accessed from ${device} (${locationLabel}).`,
      { type: "new_login", loginEventId: row.id },
    ).catch((error) => {
      logger.warn("Failed to send new login push notification", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return loginEventFromDb(row);
}

export async function listLoginHistory(
  db: Database,
  options: { userId?: string; limit?: number },
): Promise<LoginEventRecord[]> {
  const limit = options.limit ?? 20;

  const rows = options.userId
    ? await db
        .select()
        .from(loginEvents)
        .where(eq(loginEvents.userId, options.userId))
        .orderBy(desc(loginEvents.createdAt))
        .limit(limit)
    : await db.select().from(loginEvents).orderBy(desc(loginEvents.createdAt)).limit(limit);

  return rows.map(loginEventFromDb);
}

export function loginEventFromDb(row: typeof loginEvents.$inferSelect): LoginEventRecord {
  return {
    id: row.id,
    userId: row.userId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    device: row.device as LoginDevice,
    locationCity: row.locationCity,
    locationCountry: row.locationCountry,
    isNewDevice: row.isNewDevice,
    createdAt: row.createdAt,
  };
}
