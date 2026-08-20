import { beforeAll, describe, expect, it } from "vitest";
import app from "../index.js";
import { verifyPassword } from "../lib/password.js";

const VALID_PASSWORD = "TempPass123!";

async function loginToken(
  email = "admin@propninja.local",
  password = "admin",
): Promise<{ token: string; status: number }> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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

describe("User management (direct admin creation)", () => {
  let adminToken = "";
  let agentToken = "";
  let hasDb = false;

  beforeAll(async () => {
    const admin = await loginToken();
    adminToken = admin.token;
    hasDb = admin.status === 200 && (await dbReachable(adminToken));

    const agent = await loginToken("agent1@demo.propninja", "admin");
    agentToken = agent.token;
  });

  it("POST /api/users — admin creates user (happy path)", async ({ skip }) => {
    if (!hasDb) skip();

    const email = `e2e.user.${Date.now()}@example.com`;
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "E2E Created User",
        email,
        password: VALID_PASSWORD,
        role: "agent",
        isActive: true,
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      data: { id: string; email: string; name: string; isFirstLogin: boolean };
    };
    expect(json.data.email).toBe(email);
    expect(json.data.name).toBe("E2E Created User");
    expect(json.data.isFirstLogin).toBe(true);
    expect("passwordHash" in json.data).toBe(false);
  });

  it("POST /api/users — duplicate email returns 409", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Duplicate",
        email: "admin@propninja.local",
        password: VALID_PASSWORD,
        role: "agent",
      }),
    });

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("EMAIL_IN_USE");
    expect(json.error.message).toMatch(/email already in use/i);
  });

  it("POST /api/users — invalid role rejected", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Bad Role",
        email: `bad.role.${Date.now()}@example.com`,
        password: VALID_PASSWORD,
        role: "superuser",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("POST /api/users — agent forbidden", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Agent Attempt",
        email: `agent.attempt.${Date.now()}@example.com`,
        password: VALID_PASSWORD,
        role: "agent",
      }),
    });

    expect(res.status).toBe(403);
  });

  it("PATCH /api/users/:id/password — admin resets password", async ({ skip }) => {
    if (!hasDb) skip();

    const email = `reset.pw.${Date.now()}@example.com`;
    const createRes = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Reset Target",
        email,
        password: VALID_PASSWORD,
        role: "agent",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string } };
    const newPassword = "NewSecure456!";

    const patchRes = await app.request(`/api/users/${created.data.id}/password`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newPassword }),
    });
    expect(patchRes.status).toBe(200);

    const loginOld = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: VALID_PASSWORD }),
    });
    expect(loginOld.status).toBe(401);

    const loginNew = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: newPassword }),
    });
    expect(loginNew.status).toBe(200);
  });

  it("PATCH /api/users/:id/password — agent forbidden", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request("/api/users/00000000-0000-4000-8000-000000000001/password", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${agentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newPassword: "Another456!" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /api/auth/change-password — wrong current password rejected", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "definitely-wrong",
        newPassword: "NewAdmin456!",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/change-password — success clears isFirstLogin and returns new token", async ({
    skip,
  }) => {
    if (!hasDb) skip();

    const email = `first.login.${Date.now()}@example.com`;
    const tempPassword = VALID_PASSWORD;
    const newPassword = "AgentOwn456!";

    const createRes = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "First Login User",
        email,
        password: tempPassword,
        role: "agent",
      }),
    });
    expect(createRes.status).toBe(201);

    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: tempPassword }),
    });
    expect(loginRes.status).toBe(200);
    const loginJson = (await loginRes.json()) as {
      data: { token: string; user: { isFirstLogin: boolean } };
    };
    expect(loginJson.data.user.isFirstLogin).toBe(true);

    const changeRes = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${loginJson.data.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword,
      }),
    });
    expect(changeRes.status).toBe(200);
    const changeJson = (await changeRes.json()) as {
      data: { token: string; user: { isFirstLogin: boolean } };
    };
    expect(changeJson.data.user.isFirstLogin).toBe(false);
    expect(changeJson.data.token).toBeTruthy();

    const meRes = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${changeJson.data.token}` },
    });
    const meJson = (await meRes.json()) as { data: { isFirstLogin: boolean } };
    expect(meJson.data.isFirstLogin).toBe(false);

    const [row] = await import("@propninja/db").then(async (m) => {
      const { users } = m;
      const { eq } = await import("drizzle-orm");
      const { getDb } = await import("../lib/db.js");
      const db = getDb();
      return db.select().from(users).where(eq(users.email, email)).limit(1);
    });
    expect(row?.passwordHash).toBeTruthy();
    expect(await verifyPassword(newPassword, row!.passwordHash!)).toBe(true);
  });

  it("DELETE /api/users/:id — reassigns leads then deactivates", async ({ skip }) => {
    if (!hasDb) skip();

    const stamp = Date.now();
    const sourceEmail = `delete.source.${stamp}@example.com`;
    const targetEmail = `delete.target.${stamp}@example.com`;

    const createSource = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Delete Source Agent",
        email: sourceEmail,
        password: VALID_PASSWORD,
        role: "agent",
      }),
    });
    expect(createSource.status).toBe(201);
    const source = (await createSource.json()) as { data: { id: string } };

    const createTarget = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Delete Target Agent",
        email: targetEmail,
        password: VALID_PASSWORD,
        role: "agent",
      }),
    });
    expect(createTarget.status).toBe(201);
    const target = (await createTarget.json()) as { data: { id: string } };

    const createLead = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: "Delete",
        lastName: `Lead${stamp}`,
        phone: `9${String(stamp).slice(-9)}`,
        assignedTo: source.data.id,
      }),
    });
    expect(createLead.status).toBe(201);
    const lead = (await createLead.json()) as { data: { id: string } };

    const deleteWithoutReassign = await app.request(`/api/users/${source.data.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reassignToUserIds: [] }),
    });
    expect(deleteWithoutReassign.status).toBe(400);

    const deleteRes = await app.request(`/api/users/${source.data.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reassignToUserIds: [target.data.id] }),
    });
    expect(deleteRes.status).toBe(200);
    const deleted = (await deleteRes.json()) as {
      data: { user: { isActive: boolean }; reassignedLeadCount: number };
    };
    expect(deleted.data.user.isActive).toBe(false);
    expect(deleted.data.reassignedLeadCount).toBe(1);

    const leadRes = await app.request(`/api/leads/${lead.data.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(leadRes.status).toBe(200);
    const leadJson = (await leadRes.json()) as { data: { assignedTo: string | null } };
    expect(leadJson.data.assignedTo).toBe(target.data.id);
  });

  it("DELETE /api/users/:id — agent forbidden", async ({ skip }) => {
    if (!hasDb) skip();
    if (!agentToken) skip();

    const res = await app.request("/api/users/00000000-0000-4000-8000-000000000001", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${agentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reassignToUserIds: [] }),
    });
    expect(res.status).toBe(403);
  });
});
