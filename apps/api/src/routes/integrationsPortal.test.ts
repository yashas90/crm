import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStoreForTests } from "../lib/rateLimitStore.js";

const getByToken = vi.fn();
const ingestFromWebhook = vi.fn();

vi.mock("../services/portalWebhookService.js", () => ({
  portalWebhookService: {
    getByToken,
    ingestFromWebhook,
  },
}));

describe("portal integrations webhook", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetRateLimitStoreForTests();
    const { portalIntegrationsRoute } = await import("./integrationsPortal.js");
    app = new Hono();
    app.route("/api/integrations/portal", portalIntegrationsRoute);
  });

  afterEach(() => {
    vi.resetModules();
    resetRateLimitStoreForTests();
  });

  it("creates lead with valid token and mapping", async () => {
    getByToken.mockResolvedValue({
      id: "wh-1",
      portalName: "99acres",
      webhookToken: "token-abc",
      fieldMapping: {},
      isActive: true,
    });
    ingestFromWebhook.mockResolvedValue({ received: true, leadId: "lead-1" });

    const res = await app.request("/api/integrations/portal/token-abc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_name: "Rahul", sender_phone: "9876543210" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { received: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.received).toBe(true);
    expect(ingestFromWebhook).toHaveBeenCalled();
  });

  it("returns 403 for invalid token", async () => {
    getByToken.mockResolvedValue(null);

    const res = await app.request("/api/integrations/portal/bad-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
    expect(ingestFromWebhook).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid phone from service", async () => {
    getByToken.mockResolvedValue({
      id: "wh-1",
      portalName: "99acres",
      webhookToken: "token-abc",
      isActive: true,
    });
    const { AppError } = await import("../lib/errors.js");
    ingestFromWebhook.mockRejectedValue(
      new AppError("BAD_REQUEST", "Invalid lead data", 400, { fieldErrors: {} }),
    );

    const res = await app.request("/api/integrations/portal/token-abc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_phone: "12345" }),
    });

    expect(res.status).toBe(400);
  });

  it("merges duplicate phone via service", async () => {
    getByToken.mockResolvedValue({
      id: "wh-1",
      portalName: "housing",
      webhookToken: "token-abc",
      isActive: true,
    });
    ingestFromWebhook.mockResolvedValue({ received: true, leadId: "existing-lead" });

    const res = await app.request("/api/integrations/portal/token-abc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9876543210", name: "Repeat Lead" }),
    });

    expect(res.status).toBe(200);
    expect(ingestFromWebhook).toHaveBeenCalled();
  });

  it("returns 429 on 61st request per token", async () => {
    getByToken.mockResolvedValue({
      id: "wh-1",
      portalName: "99acres",
      webhookToken: "rate-token",
      isActive: true,
    });
    ingestFromWebhook.mockResolvedValue({ received: true });

    for (let i = 0; i < 60; i += 1) {
      const okRes = await app.request("/api/integrations/portal/rate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_phone: "9876543210", sender_name: "Test" }),
      });
      expect(okRes.status).toBe(200);
    }

    const limitedRes = await app.request("/api/integrations/portal/rate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_phone: "9876543210", sender_name: "Test" }),
    });

    expect(limitedRes.status).toBe(429);
    expect(ingestFromWebhook).toHaveBeenCalledTimes(60);
  });
});
