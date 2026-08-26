import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../index.js";
import { LAST_ADMIN_MESSAGE } from "../lib/lastAdminGuard.js";

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

async function getAdminUserId(token: string): Promise<string> {
  const res = await app.request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

async function findUserIdByEmail(token: string, email: string): Promise<string> {
  const res = await app.request(`/api/users?search=${encodeURIComponent(email)}&pageSize=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { data: { items: Array<{ id: string; email: string }> } };
  const user = json.data.items.find((row) => row.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user.id;
}

describe("Last admin protection", () => {
  let adminToken = "";
  let hasDb = false;
  let soleAdminId = "";

  beforeAll(async () => {
    const admin = await loginToken();
    adminToken = admin.token;
    hasDb = admin.status === 200 && (await dbReachable(adminToken));
    if (hasDb) {
      soleAdminId = await getAdminUserId(adminToken);
    }
  });

  beforeEach(async () => {
    if (!hasDb) return;
    // Parallel suites / prior cases can deactivate the seeded admin — always refresh.
    const admin = await loginToken();
    if (admin.status === 200 && admin.token) {
      adminToken = admin.token;
      soleAdminId = await getAdminUserId(adminToken);
    }
  });

  it("last admin deactivation returns 400", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request(`/api/users/${soleAdminId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: false }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toBe(LAST_ADMIN_MESSAGE);
  });

  it("last admin role change returns 400", async ({ skip }) => {
    if (!hasDb) skip();

    const res = await app.request(`/api/users/${soleAdminId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "manager" }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toBe(LAST_ADMIN_MESSAGE);
  });

  it("allows deactivation when a second admin exists", async ({ skip }) => {
    if (!hasDb) skip();

    const backupEmail = `backup.admin.${Date.now()}@example.com`;
    const createRes = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Backup Admin",
        email: backupEmail,
        password: VALID_PASSWORD,
        role: "admin",
        isActive: true,
      }),
    });
    expect(createRes.status).toBe(201);

    const deactivateRes = await app.request(`/api/users/${soleAdminId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: false }),
    });
    expect(deactivateRes.status).toBe(200);

    const backupLogin = await loginToken(backupEmail, VALID_PASSWORD);
    expect(backupLogin.status).toBe(200);

    const reactivateRes = await app.request(`/api/users/${soleAdminId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${backupLogin.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    expect(reactivateRes.status).toBe(200);

    // Refresh the original admin JWT — deactivated-user tokens stay rejected even after
    // the account is reactivated (auth checks DB isActive on each request, but the next
    // tests still need a live admin session).
    const restored = await loginToken();
    expect(restored.status).toBe(200);
    adminToken = restored.token;
  });

  it("non-admin user deactivation is always allowed", async ({ skip }) => {
    if (!hasDb) skip();

    const agentEmail = `temp.agent.${Date.now()}@example.com`;
    const createRes = await app.request("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Temp Agent",
        email: agentEmail,
        password: VALID_PASSWORD,
        role: "agent",
        isActive: true,
      }),
    });
    expect(createRes.status).toBe(201);

    const agentId = await findUserIdByEmail(adminToken, agentEmail);
    const deactivateRes = await app.request(`/api/users/${agentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: false }),
    });

    expect(deactivateRes.status).toBe(200);
  });
});
