import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../index.js";
import { escapeCsvCell } from "../lib/csv.js";
import { getJwtSecret } from "../lib/jwt.js";
import { resetLoginBruteForceForTests } from "../lib/loginBruteForce.js";

async function login(email: string, password = "admin") {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data?: { token: string } };
  return { token: json.data?.token ?? "", status: res.status };
}

describe("Phase 5 — Security audit", () => {
  let adminToken = "";
  let agentToken = "";
  let hasDb = false;

  beforeAll(async () => {
    process.env.VITEST = "true";
    const admin = await login("admin@propninja.local");
    const agent = await login("agent1@demo.propninja");
    adminToken = admin.token;
    agentToken = agent.token;
    hasDb = admin.status === 200 && agent.status === 200;
  });

  describe("Authentication bypass", () => {
    it("GET /api/leads without token → 401", async () => {
      expect((await app.request("/api/leads")).status).toBe(401);
    });

    it("GET /api/admin/security-alerts as agent → 403", async ({ skip }) => {
      if (!hasDb) skip();
      expect(
        (
          await app.request("/api/admin/security-alerts", {
            headers: { Authorization: `Bearer ${agentToken}` },
          })
        ).status,
      ).toBe(403);
    });

    it("tampered JWT (wrong userId) → 401", async ({ skip }) => {
      if (!hasDb) skip();
      const bad = await new SignJWT({
        sub: "00000000-0000-4000-8000-000000000099",
        email: "fake@test.com",
        name: "Fake",
        role: "admin",
        orgId: "00000000-0000-0000-0000-0000000000aa",
        jti: crypto.randomUUID(),
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(getJwtSecret());

      expect(
        (
          await app.request("/api/leads", {
            headers: { Authorization: `Bearer ${bad}` },
          })
        ).status,
      ).toBe(401);
    });
  });

  describe("BOLA — agent cannot access other agent resources", () => {
    it("agent cannot DELETE leads (403)", async ({ skip }) => {
      if (!hasDb) skip();
      const phone = `+9196${Date.now().toString().slice(-8)}`;
      const create = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firstName: "BOLA", lastName: "Test", phone }),
      });
      const { data } = (await create.json()) as { data: { id: string } };

      const del = await app.request(`/api/leads/${data.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(del.status).toBe(403);
    });
  });

  describe("Rate limiting", () => {
    it("6th login attempt from same IP → 429", async () => {
      resetLoginBruteForceForTests();
      const ip = "203.0.113.77";
      const headers = { "Content-Type": "application/json", "x-forwarded-for": ip };

      for (let i = 0; i < 5; i += 1) {
        await app.request("/api/auth/login", {
          method: "POST",
          headers,
          body: JSON.stringify({ email: "nobody@test.com", password: "wrong" }),
        });
      }
      const sixth = await app.request("/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "nobody@test.com", password: "wrong" }),
      });
      expect(sixth.status).toBe(429);
    });
  });

  describe("Input injection", () => {
    it("CSV formula neutralised", () => {
      expect(escapeCsvCell("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    });

    it("SQL injection name stored safely", async ({ skip }) => {
      if (!hasDb) skip();
      const name = "Robert'); DROP TABLE leads;--";
      const phone = `+9195${Date.now().toString().slice(-8)}`;
      const res = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firstName: name, lastName: "Sec", phone }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { firstName: string } };
      expect(body.data.firstName).toBe(name);
    });
  });

  describe("Sensitive data in responses", () => {
    it("GET /api/users has no password field", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/users?pageSize=5", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const text = await res.text();
      expect(text).not.toMatch(/password_hash|"password"/i);
    });

    it("login response has no password echo", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@propninja.local", password: "admin" }),
      });
      const text = await res.text();
      expect(text).not.toContain('"password":"admin"');
    });
  });

  describe("Data exfiltration limits", () => {
    it("leads pageSize capped at 200", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/leads?pageSize=999999", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = (await res.json()) as { data: { pageSize: number } };
      expect(body.data.pageSize).toBeLessThanOrEqual(200);
    });

    it("agent cannot export users CSV", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/users/export", {
        headers: { Authorization: `Bearer ${agentToken}` },
      });
      expect(res.status).toBe(403);
    });
  });
});
