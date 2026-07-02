#!/usr/bin/env node
/**
 * Quick API load check — simulates many call logs + leads polling.
 *
 * Usage (PowerShell):
 *   $env:API_URL="https://crm-production-e81d.up.railway.app"
 *   $env:LOAD_TEST_EMAIL="admin@yourcompany.com"
 *   $env:LOAD_TEST_PASSWORD="your-password"
 *   $env:AGENTS="10"
 *   $env:CALLS_PER_AGENT="20"
 *   node scripts/load-test-calls.mjs
 */

const API_URL = (process.env.API_URL ?? "https://crm-production-e81d.up.railway.app").replace(
  /\/$/,
  "",
);
const EMAIL = process.env.LOAD_TEST_EMAIL;
const PASSWORD = process.env.LOAD_TEST_PASSWORD;
const AGENTS = Math.max(1, Number(process.env.AGENTS ?? 10));
const CALLS_PER_AGENT = Math.max(1, Number(process.env.CALLS_PER_AGENT ?? 20));

if (!EMAIL || !PASSWORD) {
  console.error("Set LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables.");
  process.exit(1);
}

async function request(path, init = {}) {
  const started = performance.now();
  const response = await fetch(`${API_URL}${path}`, init);
  const ms = Math.round(performance.now() - started);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, ms, json, ok: response.ok };
}

async function login() {
  const res = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok || !res.json?.ok) {
    throw new Error(`Login failed (${res.status}): ${res.json?.error?.message ?? "unknown"}`);
  }
  return res.json.data.token;
}

async function getLeadId(token) {
  const res = await request("/api/leads?page=1&pageSize=1&excludeDuplicates=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const id = res.json?.data?.items?.[0]?.id;
  if (!id) throw new Error("No leads found — import at least one lead before load testing.");
  return id;
}

async function worker(token, leadId, workerId) {
  const results = { ok: 0, rateLimited: 0, failed: 0, ms: [] };
  for (let i = 0; i < CALLS_PER_AGENT; i++) {
    const res = await request("/api/calls/log", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        lead_id: leadId,
        phone_number: "+919999999999",
        direction: "outgoing",
        status: "completed",
        duration_seconds: 45,
        started_at: new Date(Date.now() - 60_000).toISOString(),
        ended_at: new Date().toISOString(),
        outcome: "answered",
        source: "mobile-manual",
        notes: `load-test worker ${workerId} call ${i + 1}`,
      }),
    });
    results.ms.push(res.ms);
    if (res.status === 429) results.rateLimited += 1;
    else if (res.ok && res.json?.ok) results.ok += 1;
    else results.failed += 1;
  }
  return results;
}

function summarize(label, allMs, totals) {
  const sorted = [...allMs].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  console.log(
    `${label}: ok=${totals.ok} rateLimited=${totals.rateLimited} failed=${totals.failed} p95=${p95}ms`,
  );
}

async function main() {
  console.log(`API: ${API_URL}`);
  console.log(`Simulating ${AGENTS} agents × ${CALLS_PER_AGENT} calls each\n`);

  const token = await login();
  console.log("Login OK");

  const leadId = await getLeadId(token);
  console.log(`Using lead ${leadId}\n`);

  const tabCounts = await request("/api/leads/tab-counts?excludeDuplicates=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(
    `Tab counts: HTTP ${tabCounts.status} in ${tabCounts.ms}ms${tabCounts.json?.ok ? " (ok)" : ` — ${tabCounts.json?.error?.message ?? "error"}`}`,
  );

  const workers = Array.from({ length: AGENTS }, (_, i) => worker(token, leadId, i + 1));
  const started = performance.now();
  const workerResults = await Promise.all(workers);
  const elapsed = Math.round(performance.now() - started);

  const totals = workerResults.reduce(
    (acc, r) => ({
      ok: acc.ok + r.ok,
      rateLimited: acc.rateLimited + r.rateLimited,
      failed: acc.failed + r.failed,
      ms: acc.ms.concat(r.ms),
    }),
    { ok: 0, rateLimited: 0, failed: 0, ms: [] },
  );

  console.log(`\nCompleted in ${elapsed}ms`);
  summarize("Call logs", totals.ms, totals);

  const leadsPoll = await request("/api/leads?page=1&pageSize=50&excludeDuplicates=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`Leads list: HTTP ${leadsPoll.status} in ${leadsPoll.ms}ms`);

  if (totals.rateLimited > 0) {
    console.error("\nFAIL: rate limits hit — raise limits or reduce burst.");
    process.exit(1);
  }
  if (totals.failed > 0) {
    console.error("\nFAIL: some requests failed.");
    process.exit(1);
  }
  if (!tabCounts.ok) {
    console.error("\nWARN: tab-counts failed — check Leads page badges.");
    process.exit(1);
  }

  console.log("\nOK: ready for field-team load at this scale.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
