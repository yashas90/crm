import { callRecords, leads } from "@propninja/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../index.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";

const PERF_SEED_TAG = "PerfSeed";
const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";
const LEAD_COUNT = 10_000;
const CALL_COUNT = 50_000;
const MAX_LEADS_LIST_MS = 300;
const MAX_ANALYTICS_MS = 2000;

async function loginToken(): Promise<{ token: string; status: number }> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@propninja.local", password: "admin" }),
  });
  const json = (await res.json()) as { data?: { token: string } };
  return { token: json.data?.token ?? "", status: res.status };
}

async function dbReachable(token: string) {
  const res = await app.request("/api/leads?page=1&pageSize=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

async function seedPerfLeads(): Promise<void> {
  await db.execute(sql`
    INSERT INTO leads (org_id, first_name, last_name, phone, lead_status, created_at, updated_at)
    SELECT
      ${SINGLE_TENANT_ORG_ID}::uuid,
      ${PERF_SEED_TAG},
      'Lead' || i::text,
      '+9198' || lpad(i::text, 8, '0'),
      (ARRAY['new', 'contacted', 'qualified', 'negotiation'])[1 + (i % 4)],
      now() - (i || ' minutes')::interval,
      now()
    FROM generate_series(1, ${LEAD_COUNT}) AS i
  `);
}

async function seedPerfCalls(): Promise<void> {
  await db.execute(sql`
    WITH perf_leads AS (
      SELECT id, row_number() OVER (ORDER BY created_at) AS rn
      FROM leads
      WHERE first_name = ${PERF_SEED_TAG}
    )
    INSERT INTO call_records (
      org_id,
      user_id,
      lead_id,
      phone_number,
      direction,
      status,
      source,
      started_at,
      ended_at,
      duration_seconds,
      disposition,
      notes
    )
    SELECT
      ${SINGLE_TENANT_ORG_ID}::uuid,
      ${ADMIN_USER_ID}::uuid,
      pl.id,
      '+919800000001',
      'outgoing',
      'completed',
      'mobile-manual',
      now() - (i || ' minutes')::interval,
      now() - (i || ' minutes')::interval + interval '2 minutes',
      120,
      'completed',
      ${PERF_SEED_TAG}
    FROM generate_series(1, ${CALL_COUNT}) AS i
    JOIN perf_leads pl ON pl.rn = ((i - 1) % ${LEAD_COUNT}) + 1
  `);
}

async function cleanupPerfData(): Promise<void> {
  await db.delete(callRecords).where(eq(callRecords.notes, PERF_SEED_TAG));
  await db.delete(leads).where(eq(leads.firstName, PERF_SEED_TAG));
}

describe("API performance", () => {
  let token = "";
  let hasDb = false;

  beforeAll(async () => {
    process.env.VITEST = "true";
    const login = await loginToken();
    token = login.token;
    hasDb = login.status === 200 && (await dbReachable(token));
    if (!hasDb) return;

    await cleanupPerfData();
    await seedPerfLeads();
    await seedPerfCalls();
  }, 300_000);

  afterAll(async () => {
    if (hasDb) {
      await cleanupPerfData();
    }
  }, 120_000);

  it(`GET /api/leads responds in under ${MAX_LEADS_LIST_MS}ms with ${LEAD_COUNT} leads`, async ({
    skip,
  }) => {
    if (!hasDb) skip();

    const start = performance.now();
    const res = await app.request("/api/leads?page=1&pageSize=50", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { items: unknown[]; total: number };
    };
    expect(json.ok).toBe(true);
    expect(json.data.items.length).toBe(50);
    expect(json.data.total).toBeGreaterThanOrEqual(LEAD_COUNT);
    expect(elapsed).toBeLessThan(MAX_LEADS_LIST_MS);
  });

  it(`GET /api/analytics/overview responds in under ${MAX_ANALYTICS_MS}ms`, async ({ skip }) => {
    if (!hasDb) skip();

    const start = performance.now();
    const res = await app.request("/api/analytics/overview", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { kpis: unknown } };
    expect(json.ok).toBe(true);
    expect(json.data.kpis).toBeDefined();
    expect(elapsed).toBeLessThan(MAX_ANALYTICS_MS);
  });
});
