import { agentLocations, users } from "@propninja/db";
import { getIstDateKey, istWallClockToDate } from "@propninja/types/ist";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const locationRoutes = new Hono();

const pingBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  capturedAt: z.string().datetime({ offset: true }),
});

const historyQuerySchema = z.object({
  userId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function requireManager(authUser: AuthUser) {
  return authUser.role === "admin" || authUser.role === "manager";
}

locationRoutes.post("/ping", writeRateLimit, validate("json", pingBodySchema), async (c) => {
  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const db = c.get("db");

  await db.insert(agentLocations).values({
    userId: authUser.id,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy ?? null,
    capturedAt: new Date(body.capturedAt),
  });

  return jsonOk(c, { ok: true as const }, undefined, 201);
});

locationRoutes.get("/live", async (c) => {
  const authUser = c.get("authUser");
  if (!requireManager(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const db = c.get("db");
  const rows = await db.execute<{
    user_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    captured_at: Date | string;
    name: string;
    email: string;
  }>(sql`
    SELECT DISTINCT ON (${agentLocations.userId})
      ${agentLocations.userId} AS user_id,
      ${agentLocations.latitude} AS latitude,
      ${agentLocations.longitude} AS longitude,
      ${agentLocations.accuracy} AS accuracy,
      ${agentLocations.capturedAt} AS captured_at,
      ${users.name} AS name,
      ${users.email} AS email
    FROM ${agentLocations}
    INNER JOIN ${users} ON ${users.id} = ${agentLocations.userId}
    WHERE ${agentLocations.capturedAt} > NOW() - INTERVAL '15 minutes'
    ORDER BY ${agentLocations.userId}, ${agentLocations.capturedAt} DESC
  `);

  const agents = rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    capturedAt:
      row.captured_at instanceof Date
        ? row.captured_at.toISOString()
        : new Date(row.captured_at).toISOString(),
  }));

  return jsonOk(c, { agents });
});

locationRoutes.get("/history", validate("query", historyQuerySchema), async (c) => {
  const authUser = c.get("authUser");
  if (!requireManager(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const { userId, date } = c.req.valid("query");
  const dateKey = date ?? getIstDateKey();
  const dayStart = istWallClockToDate(dateKey, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const db = c.get("db");
  const rows = await db
    .select({
      id: agentLocations.id,
      latitude: agentLocations.latitude,
      longitude: agentLocations.longitude,
      accuracy: agentLocations.accuracy,
      capturedAt: agentLocations.capturedAt,
    })
    .from(agentLocations)
    .where(
      and(
        eq(agentLocations.userId, userId),
        gte(agentLocations.capturedAt, dayStart),
        lte(agentLocations.capturedAt, dayEnd),
      ),
    )
    .orderBy(asc(agentLocations.capturedAt));

  const items = rows.map((row) => ({
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    capturedAt: row.capturedAt.toISOString(),
  }));

  return jsonOk(c, { items, total: items.length });
});
