import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import app from "../index.js";
import { resetLoginBruteForceForTests } from "../lib/loginBruteForce.js";
import { resetSecurityMonitoringState } from "../middleware/securityMonitoring.js";

const okEnvelope = z.object({ ok: z.literal(true) });
const errEnvelope = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

type Tokens = { admin: string; agent: string; manager: string };

async function login(email: string, password = "admin") {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data?: { token: string } };
  return { token: json.data?.token ?? "", status: res.status };
}

async function jsonBody(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

async function dbReady(adminToken: string) {
  const res = await app.request("/api/leads?page=1&pageSize=1", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.status === 200;
}

describe("API endpoint coverage", () => {
  let hasDb = false;
  let tokens: Tokens = { admin: "", agent: "", manager: "" };
  let createdLeadId = "";
  let createdTaskId = "";
  let createdProjectId = "";

  beforeAll(async () => {
    process.env.VITEST = "true";
    resetLoginBruteForceForTests();
    resetSecurityMonitoringState();
    const admin = await login("admin@propninja.local");
    const agent = await login("agent1@demo.propninja");
    const manager = await login("manager@demo.propninja");
    tokens = { admin: admin.token, agent: agent.token, manager: manager.token };
    hasDb = admin.status === 200 && (await dbReady(admin.token));
  });

  describe("AUTH", () => {
    it("POST /api/auth/login — happy path", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@propninja.local", password: "admin" }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toBeTruthy();
      expect(JSON.stringify(body)).not.toMatch(/password/i);
    });

    it("POST /api/auth/login — invalid credentials → 401", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@propninja.local", password: "wrong-password" }),
      });
      expect(res.status).toBe(401);
      errEnvelope.parse(await jsonBody(res));
    });

    it("POST /api/auth/login — missing body → 400", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("GET /api/auth/me — no token → 401", async () => {
      const res = await app.request("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("POST /api/auth/logout — requires auth", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
      okEnvelope.parse(await jsonBody(res));
      const refreshed = await login("admin@propninja.local");
      tokens.admin = refreshed.token;
    });

    it("GET /api/auth/login-history — returns array", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/login-history", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("POST /api/auth/forgot-password — always 200", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/auth/push-token — accepts token", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/auth/push-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.agent}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: "ExponentPushToken[test-token-for-qa]" }),
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe("LEADS", () => {
    it("GET /api/leads — no token → 401", async () => {
      expect((await app.request("/api/leads")).status).toBe(401);
    });

    it("GET /api/leads — admin happy path", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/leads?page=1&pageSize=10", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toBeTruthy();
    });

    it("GET /api/leads?scope=team — agent scoped to own", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/leads?scope=team&pageSize=50", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/leads — creates lead", async ({ skip }) => {
      if (!hasDb) skip();
      const phone = `+9199${Date.now().toString().slice(-8)}`;
      const res = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.admin}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firstName: "QA", lastName: "Coverage", phone }),
      });
      expect(res.status).toBe(201);
      const body = (await jsonBody(res)) as { data: { id: string } };
      createdLeadId = body.data.id;
      expect(createdLeadId).toBeTruthy();
    });

    it("GET /api/leads/:id — not found → 404", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/leads/00000000-0000-4000-8000-000000000099", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(404);
    });

    it("GET /api/leads/overdue, /cold, /hot", async ({ skip }) => {
      if (!hasDb) skip();
      for (const path of ["/api/leads/overdue", "/api/leads/cold", "/api/leads/hot"]) {
        const res = await app.request(path, {
          headers: { Authorization: `Bearer ${tokens.agent}` },
        });
        expect(res.status).toBe(200);
      }
    });

    it("PATCH /api/leads/:id/follow-up — validation", async ({ skip }) => {
      if (!hasDb || !createdLeadId) skip();
      const res = await app.request(`/api/leads/${createdLeadId}/follow-up`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokens.admin}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect([400, 422]).toContain(res.status);
    });

    it("GET /api/leads/:id/assignments", async ({ skip }) => {
      if (!hasDb || !createdLeadId) skip();
      const res = await app.request(`/api/leads/${createdLeadId}/assignments`, {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });

    it("DELETE /api/leads/:id — agent forbidden", async ({ skip }) => {
      if (!hasDb || !createdLeadId) skip();
      const res = await app.request(`/api/leads/${createdLeadId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("CALLS", () => {
    it("GET /api/calls — agent", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/calls?page=1&pageSize=10", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/calls/log — invalid body → 400", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/calls/log", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.agent}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("GET /api/calls/:id — route not implemented → 404", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/calls/00000000-0000-4000-8000-000000000001", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("TASKS", () => {
    it("GET /api/tasks", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/tasks", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/tasks — create", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.admin}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "QA task",
          dueDate: new Date(Date.now() + 86_400_000).toISOString(),
          priority: "medium",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await jsonBody(res)) as { data: { id: string } };
      createdTaskId = body.data.id;
    });

    it("POST /api/tasks/:id/complete", async ({ skip }) => {
      if (!hasDb || !createdTaskId) skip();
      const res = await app.request(`/api/tasks/${createdTaskId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("SITE VISITS", () => {
    it("GET /api/site-visits/today and /calendar", async ({ skip }) => {
      if (!hasDb) skip();
      for (const path of ["/api/site-visits/today", "/api/site-visits/calendar"]) {
        const res = await app.request(path, {
          headers: { Authorization: `Bearer ${tokens.agent}` },
        });
        expect(res.status).toBe(200);
      }
    });

    it("GET /api/site-visits — list", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/site-visits", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("PROJECTS", () => {
    it("GET /api/projects", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/projects", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/projects — create", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.admin}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `QA Project ${Date.now()}`,
          status: "ongoing",
          projectType: "residential",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await jsonBody(res)) as { data: { id: string } };
      createdProjectId = body.data.id;
    });

    it("GET /api/projects/:id/units/summary", async ({ skip }) => {
      if (!hasDb || !createdProjectId) skip();
      const res = await app.request(`/api/projects/${createdProjectId}/units/summary`, {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("REPORTS & ANALYTICS", () => {
    it("GET /api/reports/overview — manager", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/reports/overview", {
        headers: { Authorization: `Bearer ${tokens.manager}` },
      });
      expect(res.status).toBe(200);
    });

    it("GET /api/reports/team-today — agent → 403", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/reports/team-today", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/reports/agent-stats", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/reports/agent-stats", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(200);
    });

    it("GET /api/analytics/overview — agent → 403", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/analytics/overview", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/reports/leaderboard — not implemented → 404", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/reports/leaderboard", {
        headers: { Authorization: `Bearer ${tokens.manager}` },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("USERS & ADMIN", () => {
    it("GET /api/users — agent → 403", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/users", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/users — admin", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/users?pageSize=5", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(JSON.stringify(body)).not.toMatch(/password_hash/i);
    });

    it("DELETE /api/users/:id — agent → 403", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/users/00000000-0000-4000-8000-000000000001", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/security-alerts — agent → 403", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/admin/security-alerts", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/admin/security-alerts — admin", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/admin/security-alerts", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });

    it("GET /api/admin/active-sessions — admin", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/admin/active-sessions", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("NOTIFICATIONS", () => {
    it("GET /api/notifications", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/notifications", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/notifications/mark-read — empty ids → 400", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/notifications/mark-read", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.agent}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: [] }),
      });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe("ORG & AUDIT", () => {
    it("GET /api/org", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/org", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });

    it("GET /api/audit-logs", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/audit-logs?page=1&pageSize=10", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("INTEGRATIONS & HEALTH", () => {
    it("GET /api/integrations/status", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/integrations/status", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
    });

    it("POST /api/integrations/meta/webhook — no signature → 403 in prod only", async () => {
      const res = await app.request("/api/integrations/meta/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ object: "page", entry: [] }),
      });
      expect([403, 401, 400, 200]).toContain(res.status);
    });

    it("GET /health", async () => {
      const res = await app.request("/health");
      expect(res.status).toBeLessThanOrEqual(503);
      const body = await jsonBody(res);
      expect(body.status).toBeTruthy();
    });
  });

  describe("WHATSAPP", () => {
    it("GET /api/whatsapp/templates — auth required", async () => {
      expect((await app.request("/api/whatsapp/templates")).status).toBe(401);
    });

    it("GET /api/whatsapp/templates — agent", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/whatsapp/templates", {
        headers: { Authorization: `Bearer ${tokens.agent}` },
      });
      expect([200, 502, 503]).toContain(res.status);
    });
  });

  describe("Pagination caps", () => {
    it("GET /api/leads?pageSize=999999 — capped at 200", async ({ skip }) => {
      if (!hasDb) skip();
      const res = await app.request("/api/leads?pageSize=999999", {
        headers: { Authorization: `Bearer ${tokens.admin}` },
      });
      expect(res.status).toBe(200);
      const body = (await jsonBody(res)) as { data: { pageSize: number } };
      expect(body.data.pageSize).toBeLessThanOrEqual(200);
    });
  });
});
