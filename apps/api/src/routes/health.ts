import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { getApiVersion } from "../lib/apiVersion.js";
import { db } from "../lib/db.js";

const DB_CHECK_TIMEOUT_MS = 3_000;

export const healthRoutes = new Hono();

async function checkDatabase(): Promise<void> {
  const query = db.execute(sql`select 1`);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Database check timed out")), DB_CHECK_TIMEOUT_MS);
  });

  await Promise.race([query, timeout]);
}

healthRoutes.get("/", async (c) => {
  const timestamp = new Date().toISOString();
  const version = getApiVersion();

  try {
    await checkDatabase();
    return c.json({ status: "ok", version, timestamp, service: "propninja-api", db: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    // Return 200 so Railway liveness passes while Postgres is still connecting.
    return c.json({ status: "degraded", version, timestamp, service: "propninja-api", db: "error", message });
  }
});
