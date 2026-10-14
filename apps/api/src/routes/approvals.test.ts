import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AGENT = {
  id: "00000000-0000-0000-0000-000000000001",
  role: "agent" as const,
  email: "agent@test.com",
  name: "Agent",
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

const MANAGER = {
  ...AGENT,
  id: "00000000-0000-0000-0000-000000000002",
  role: "manager" as const,
  email: "manager@test.com",
  name: "Manager",
};

const ADMIN = {
  ...AGENT,
  id: "00000000-0000-0000-0000-000000000003",
  role: "admin" as const,
  email: "admin@test.com",
  name: "Admin",
};

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  approveIncentive: vi.fn(),
  rejectIncentive: vi.fn(),
  disburse: vi.fn(),
}));

vi.mock("../services/approvalService.js", () => ({
  createApprovalService: () => mocks,
}));

async function makeApp(user: typeof AGENT) {
  const { approvalRoutes } = await import("./approvals.js");
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("db", {});
    c.set("authUser", user);
    await next();
  });
  app.route("/api/approvals", approvalRoutes);
  return app;
}

describe("approval routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summary.mockResolvedValue({ pendingIncentives: { employees: 0, total: 0 } });
  });

  it("returns 403 when an agent tries to approve", async () => {
    const app = await makeApp(AGENT);
    const res = await app.request(
      "/api/approvals/incentives/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/approve",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
    expect(mocks.approveIncentive).not.toHaveBeenCalled();
  });

  it("returns 403 when a manager tries to disburse", async () => {
    const app = await makeApp(MANAGER);
    const res = await app.request("/api/approvals/incentives/disburse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quarter: "2026-JAS" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.disburse).not.toHaveBeenCalled();
  });

  it("lets an admin load the summary", async () => {
    const app = await makeApp(ADMIN);
    const res = await app.request("/api/approvals/summary");
    expect(res.status).toBe(200);
    expect(mocks.summary).toHaveBeenCalledOnce();
  });
});
