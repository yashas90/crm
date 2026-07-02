#!/usr/bin/env node
/**
 * Quick API load check — simulates call logs + leads polling.
 *
 * Default mode spreads calls over time (realistic for one agent session).
 * Set BURST=true to hammer the API in parallel (stress test).
 *
 * Usage (PowerShell):
 *   $env:API_URL="https://crm-production-e81d.up.railway.app"
 *   $env:LOAD_TEST_EMAIL="admin@propninja.com"
 *   $env:LOAD_TEST_PASSWORD="your-password"
 *   $env:AGENTS="10"
 *   $env:CALLS_PER_AGENT="20"
 *   $env:CALL_DELAY_MS="300"
 *   pnpm load-test:calls
 */

const API_URL = (process.env.API_URL ?? "https://crm-production-e81d.up.railway.app").replace(
  /\/$/,
  "",
);
const EMAIL = process.env.LOAD_TEST_EMAIL;
const PASSWORD = process.env.LOAD_TEST_PASSWORD;
const AGENTS = Math.max(1, Number(process.env.AGENTS ?? 10));
const CALLS_PER_AGENT = Math.max(1, Number(process.env.CALLS_PER_AGENT ?? 20));
const CALL_DELAY_MS = Math.max(0, Number(process.env.CALL_DELAY_MS ?? 300));
const BURST = process.env.BURST === "true" || process.env.BURST === "1";

if (!EMAIL || !PASSWORD) {
  console.error("Set LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function logCall(token, leadId, workerId, callIndex) {
  return request("/api/calls/log", {
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
      notes: `load-test worker ${workerId} call ${callIndex}`,
    }),
  });
}

function tallyResult(results, res) {
  results.ms.push(res.ms);
  if (res.status === 429) results.rateLimited += 1;
  else if (res.ok && res.json?.ok) results.ok += 1;
  else results.failed += 1;
}

async function workerSequential(token, leadId, workerId) {
  const results = { ok: 0, rateLimited: 0, failed: 0, ms: [] };
  for (let i = 0; i < CALLS_PER_AGENT; i++) {
    const res = await logCall(token, leadId, workerId, i + 1);
    tallyResult(results, res);
    if (CALL_DELAY_MS > 0 && i < CALLS_PER_AGENT - 1) {
      await sleep(CALL_DELAY_MS);
    }
  }
  return results;
}

async function runRealisticLoad(token, leadId) {
  const results = { ok: 0, rateLimited: 0, failed: 0, ms: [] };
  const totalCalls = AGENTS * CALLS_PER_AGENT;
  console.log(
    `Mode: realistic — ${totalCalls} sequential calls, ${CALL_DELAY_MS}ms between each (~${Math.round((totalCalls * CALL_DELAY_MS) / 1000)}s)\n`,
  );

  let callNo = 0;
  for (let agent = 1; agent <= AGENTS; agent++) {
    for (let i = 0; i < CALLS_PER_AGENT; i++) {
      callNo += 1;
      const res = await logCall(token, leadId, agent, callNo);
      tallyResult(results, res);
      if (CALL_DELAY_MS > 0 && callNo < totalCalls) {
        await sleep(CALL_DELAY_MS);
      }
    }
  }
  return results;
}

async function runBurstLoad(token, leadId) {
  console.log(`Mode: burst — ${AGENTS} parallel workers × ${CALLS_PER_AGENT} calls each\n`);
  const workers = Array.from({ length: AGENTS }, (_, i) =>
    workerSequential(token, leadId, i + 1),
  );
  const workerResults = await Promise.all(workers);
  return workerResults.reduce(
    (acc, r) => ({
      ok: acc.ok + r.ok,
      rateLimited: acc.rateLimited + r.rateLimited,
      failed: acc.failed + r.failed,
      ms: acc.ms.concat(r.ms),
    }),
    { ok: 0, rateLimited: 0, failed: 0, ms: [] },
  );
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
  console.log(`Target: ${AGENTS} agents × ${CALLS_PER_AGENT} calls each\n`);

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
  if (tabCounts.json?.ok) {
    console.log(
      `  scope.all=${tabCounts.json.data.scope.all} stage.active=${tabCounts.json.data.stage.active}`,
    );
  }

  const started = performance.now();
  const totals = BURST
    ? await runBurstLoad(token, leadId)
    : await runRealisticLoad(token, leadId);
  const elapsed = Math.round(performance.now() - started);

  console.log(`\nCompleted in ${elapsed}ms`);
  summarize("Call logs", totals.ms, totals);

  const leadsPoll = await request("/api/leads?page=1&pageSize=50&excludeDuplicates=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`Leads list: HTTP ${leadsPoll.status} in ${leadsPoll.ms}ms`);

  let failed = false;

  if (!tabCounts.ok) {
    console.error("\nFAIL: tab-counts returned non-200 — Leads page badges will be broken.");
    failed = true;
  }
  if (totals.failed > 0) {
    console.error("\nFAIL: some call log requests failed.");
    failed = true;
  }
  if (totals.rateLimited > 0) {
    const msg = BURST
      ? "\nFAIL: rate limits hit during burst test."
      : "\nFAIL: rate limits hit during realistic test — unexpected at this pace.";
    console.error(msg);
    failed = true;
  }

  if (failed) {
    process.exit(1);
  }

  console.log("\nOK: ready for field-team load at this scale.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
