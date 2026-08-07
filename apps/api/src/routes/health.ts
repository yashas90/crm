import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { getApiVersion } from "../lib/apiVersion.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";

const DB_CHECK_TIMEOUT_MS = 3_000;

export const healthRoutes = new Hono();

async function checkDatabase(): Promise<void> {
  const query = db.execute(sql`select 1`);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Database check timed out")), DB_CHECK_TIMEOUT_MS);
  });

  await Promise.race([query, timeout]);
}

async function checkSiteVisitsSchema(): Promise<string | null> {
  const result = await db.execute<{ column_name: string }>(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_visits'
      and column_name in ('public_token', 'reminders_sent')
  `);
  const columns = new Set(result.map((row) => row.column_name));
  const missing: string[] = [];
  if (!columns.has("public_token")) missing.push("public_token");
  if (!columns.has("reminders_sent")) missing.push("reminders_sent");
  if (missing.length === 0) return null;
  return `site_visits missing columns: ${missing.join(", ")} — run db:migrate on the API`;
}

function mobileVersionFields() {
  return {
    minMobileAppVersion: env.MIN_MOBILE_APP_VERSION?.trim() || null,
    mobileUpdateUrl: env.MOBILE_UPDATE_URL?.trim() || null,
  };
}

healthRoutes.get("/", async (c) => {
  const timestamp = new Date().toISOString();
  const version = getApiVersion();
  const mobile = mobileVersionFields();

  try {
    await checkDatabase();
    const schemaIssue = await checkSiteVisitsSchema();
    if (schemaIssue) {
      return c.json({
        status: "degraded",
        version,
        timestamp,
        service: "propninja-api",
        db: "ok",
        schema: schemaIssue,
        ...mobile,
      });
    }
    return c.json({
      status: "ok",
      version,
      timestamp,
      service: "propninja-api",
      db: "ok",
      ...mobile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    // Return 200 so Railway liveness passes while Postgres is still connecting.
    return c.json({
      status: "degraded",
      version,
      timestamp,
      service: "propninja-api",
      db: "error",
      message,
      ...mobile,
    });
  }
});
