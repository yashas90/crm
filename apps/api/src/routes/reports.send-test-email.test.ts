import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTestReportEmail = vi.fn();

vi.mock("../services/reportEmailService.js", () => ({
  sendTestReportEmail,
}));

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Admin",
  role: "admin" as const,
  orgId: "00000000-0000-0000-0000-000000000001",
  isFirstLogin: false,
};

const managerUser = {
  ...adminUser,
  id: "00000000-0000-0000-0000-000000000004",
  email: "manager@propninja.local",
  name: "Manager",
  role: "manager" as const,
};

describe("POST /api/reports/send-test-email", () => {
  let currentUser = adminUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = adminUser;
    sendTestReportEmail.mockResolvedValue({ sent: true });
  });

  async function app() {
    const { reportsRoutes } = await import("./reports.js");
    const api = new Hono();
    api.use("*", async (c, next) => {
      c.set("authUser", currentUser);
      await next();
    });
    api.route("/api/reports", reportsRoutes);
    return api;
  }

  it("sends a test report to the signed-in admin", async () => {
    const res = await (await app()).request("/api/reports/send-test-email", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { sent: true } });
    expect(sendTestReportEmail).toHaveBeenCalledWith({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
    });
  });

  it("rejects managers", async () => {
    currentUser = managerUser;
    const res = await (await app()).request("/api/reports/send-test-email", { method: "POST" });
    expect(res.status).toBe(403);
    expect(sendTestReportEmail).not.toHaveBeenCalled();
  });

  it("returns 503 when email delivery is not configured", async () => {
    sendTestReportEmail.mockResolvedValue({ sent: false, reason: "not_configured" });
    const res = await (await app()).request("/api/reports/send-test-email", { method: "POST" });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("EMAIL_NOT_CONFIGURED");
  });
});
