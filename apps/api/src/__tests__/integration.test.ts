import { beforeAll, describe, expect, it } from "vitest";
import app from "../index.js";

async function loginToken() {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@propninja.local", password: "admin" }),
  });
  expect(res.status).toBe(200);
  const json = (await res.json()) as { data: { token: string } };
  return json.data.token;
}

async function dbReachable(token: string) {
  const res = await app.request("/api/leads?page=1&pageSize=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status === 200;
}

describe("API integration", () => {
  let token = "";
  let hasDb = false;

  beforeAll(async () => {
    process.env.VITEST = "true";
    token = await loginToken();
    hasDb = await dbReachable(token);
  });

  it("POST /api/leads creates a lead", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9199${Date.now().toString().slice(-8)}`;
    const res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Lead",
        phone,
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { ok: boolean; data: { id: string; phone: string } };
    expect(json.ok).toBe(true);
    expect(json.data.phone).toBe(phone);
  });

  it("POST /api/leads rejects duplicate phone", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9198${Date.now().toString().slice(-8)}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const first = await app.request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({ firstName: "Dup", lastName: "One", phone }),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({ firstName: "Dup", lastName: "Two", phone }),
    });
    expect(second.status).toBe(409);
    const json = (await second.json()) as { error: { code: string } };
    expect(json.error.code).toBe("LEAD_DUPLICATE_PHONE");
  });

  it("POST /api/leads/bulk-import creates multiple leads and skips duplicates", async ({
    skip,
  }) => {
    if (!hasDb) skip();

    const phoneA = `+9196${Date.now().toString().slice(-8)}`;
    const phoneB = `+9195${Date.now().toString().slice(-8)}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const res = await app.request("/api/leads/bulk-import", {
      method: "POST",
      headers,
      body: JSON.stringify({
        skipDuplicates: true,
        leads: [
          { firstName: "Bulk", lastName: "One", phone: phoneA, city: "Mumbai" },
          { firstName: "Bulk", lastName: "Two", phone: phoneB },
          { firstName: "Bulk", lastName: "Dup", phone: phoneA },
          { firstName: "", phone: "123" },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      data: { createdCount: number; skippedCount: number; failedCount: number };
    };
    expect(json.data.createdCount).toBe(2);
    expect(json.data.skippedCount).toBe(1);
    expect(json.data.failedCount).toBe(1);
  });

  it("POST /api/calls/log creates call and updates lastContactedAt", async ({ skip }) => {
    if (!hasDb) skip();

    const phone = `+9197${Date.now().toString().slice(-8)}`;
    const createRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ firstName: "Call", lastName: "Target", phone }),
    });
    const created = (await createRes.json()) as {
      data: { id: string; lastContactedAt: string | null };
    };
    const leadId = created.data.id;
    expect(created.data.lastContactedAt).toBeNull();

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - 60_000);

    const logRes = await app.request("/api/calls/log", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lead_id: leadId,
        phone_number: phone,
        direction: "outgoing",
        status: "completed",
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: 60,
        disposition: "interested",
        source: "mobile-manual",
      }),
    });
    expect(logRes.status).toBe(201);

    const leadRes = await app.request(`/api/leads/${leadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const leadJson = (await leadRes.json()) as { data: { lastContactedAt: string | null } };
    expect(leadJson.data.lastContactedAt).not.toBeNull();
  });
});
