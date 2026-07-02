import { beforeAll, describe, expect, it } from "vitest";
import app from "../index.js";
import { recordEmailLoginAttempt, resetLoginBruteForceForTests } from "../lib/loginBruteForce.js";
import { hashPassword } from "../lib/password.js";
import { stripHtmlTags } from "../lib/sanitize.js";

async function loginToken(
  email: string,
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

describe("OWASP security — static checks", () => {
  it("A02: passwords are hashed with bcrypt cost factor >= 12", async () => {
    const hash = await hashPassword("audit-test-password");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    const rounds = Number.parseInt(hash.split("$")[2] ?? "0", 10);
    expect(rounds).toBeGreaterThanOrEqual(12);
  });

  it("A03: XSS search payloads are stripped by sanitisation helpers", () => {
    const payload = "<script>alert(1)</script>";
    expect(stripHtmlTags(payload)).toBe("alert(1)");
  });

  it("A05: CORS rejects evil.com — no Access-Control-Allow-Origin for disallowed origin", async () => {
    const res = await app.request("/api/leads?page=1&pageSize=1", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    const allowOrigin = res.headers.get("Access-Control-Allow-Origin");
    expect(allowOrigin).not.toBe("https://evil.com");
  });

  it("A07: 31st failed login for same email is rate limited (429)", async () => {
    resetLoginBruteForceForTests();
    const email = "locked-out@propninja.com";

    for (let i = 0; i < 30; i += 1) {
      recordEmailLoginAttempt(email);
    }

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    });

    expect(res.status).toBe(429);
  });
});

describe("OWASP security — integration (requires DB)", () => {
  let adminToken = "";
  let hasDb = false;

  beforeAll(async () => {
    process.env.VITEST = "true";
    const login = await loginToken("admin@propninja.local");
    adminToken = login.token;
    hasDb = login.status === 200 && (await dbReachable(adminToken));
  });

  it("A01: agent with scope=team sees only own leads", async ({ skip }) => {
    if (!hasDb) skip();

    const agent1 = await loginToken("agent1@demo.propninja");
    const agent2 = await loginToken("agent2@demo.propninja");
    expect(agent1.status).toBe(200);
    expect(agent2.status).toBe(200);

    const me1 = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${agent1.token}` },
    });
    const me1Json = (await me1.json()) as { data: { id: string } };
    const agent1Id = me1Json.data.id;

    const me2 = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${agent2.token}` },
    });
    const me2Json = (await me2.json()) as { data: { id: string } };
    const agent2Id = me2Json.data.id;

    const phoneSuffix = Date.now().toString().slice(-6);
    const createForAgent2 = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: "OWASP",
        lastName: "TeamScope",
        phone: `+9198${phoneSuffix}`,
        assignedTo: agent2Id,
      }),
    });
    expect(createForAgent2.status).toBe(201);

    const res = await app.request("/api/leads?scope=team&pageSize=100", {
      headers: { Authorization: `Bearer ${agent1.token}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { items: Array<{ assignedTo?: string | null; lastName?: string }> };
    };

    for (const lead of json.data.items) {
      expect(lead.assignedTo).toBe(agent1Id);
    }
    const teamScopeLeak = json.data.items.some((l) => l.lastName === "TeamScope");
    expect(teamScopeLeak).toBe(false);
  });

  it("A01: agent DELETE /api/users/:id returns 403", async ({ skip }) => {
    if (!hasDb) skip();

    const agent = await loginToken("agent1@demo.propninja");
    expect(agent.status).toBe(200);

    const usersRes = await app.request("/api/users?pageSize=1", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersJson = (await usersRes.json()) as { data: { items: Array<{ id: string }> } };
    const targetId = usersJson.data.items[0]?.id;
    expect(targetId).toBeTruthy();

    const deleteRes = await app.request(`/api/users/${targetId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    expect(deleteRes.status).toBe(403);
  });

  it("A01: agent GET /api/reports/team-today returns 403", async ({ skip }) => {
    if (!hasDb) skip();

    const agent = await loginToken("agent1@demo.propninja");
    expect(agent.status).toBe(200);

    const res = await app.request("/api/reports/team-today", {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    expect(res.status).toBe(403);
  });

  it("A03: SQL injection in lead name is stored safely (parameterised query)", async ({ skip }) => {
    if (!hasDb) skip();

    const maliciousName = "Robert'); DROP TABLE leads;--";
    const phone = `+9197${Date.now().toString().slice(-7)}`;

    const createRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: maliciousName,
        lastName: "InjectionTest",
        phone,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string; firstName: string } };
    expect(created.data.firstName).toBe(maliciousName);

    const listRes = await app.request("/api/leads?pageSize=5", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.status).toBe(200);

    const searchRes = await app.request(
      `/api/leads?search=${encodeURIComponent("<script>alert(1)</script>")}&pageSize=5`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(searchRes.status).toBe(200);
  });

  it("A07: revoked token returns 401 after admin revokes sessions", async ({ skip }) => {
    if (!hasDb) skip();

    const agent = await loginToken("agent3@demo.propninja");
    expect(agent.status).toBe(200);

    const meRes = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    const meJson = (await meRes.json()) as { data: { id: string } };
    const agentId = meJson.data.id;

    const revokeRes = await app.request(`/api/admin/users/${agentId}/revoke-sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(revokeRes.status).toBe(200);

    const afterRevoke = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    expect(afterRevoke.status).toBe(401);
  });
});
