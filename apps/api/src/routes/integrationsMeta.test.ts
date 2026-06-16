import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ingestAdLead = vi.fn(async () => ({ id: "lead-abc-123" }));
const getLeadDetails = vi.fn();

vi.mock("../lib/env.js", () => ({
  env: {
    META_VERIFY_TOKEN: "test-verify-token",
    META_APP_SECRET: "test-app-secret",
    PAGE_ACCESS_TOKEN: "page-token",
    NODE_ENV: "test",
  },
}));

vi.mock("../lib/facebook.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/facebook.js")>();
  return {
    ...actual,
    getLeadDetails,
    enrichFacebookAdLeadMetadata: vi.fn(async (lead: unknown) => lead),
  };
});

vi.mock("../services/adLeadService.js", () => ({
  adLeadService: { ingestAdLead },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  metaWebhookRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

function signBody(rawBody: string, secret: string) {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

describe("Meta integrations webhook", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    getLeadDetails.mockResolvedValue({
      id: "leadgen-999",
      field_data: [
        { name: "full_name", values: ["Jane Doe"] },
        { name: "phone_number", values: ["+919876543210"] },
        { name: "email", values: ["jane@example.com"] },
        { name: "ad_name", values: ["Summer Promo"] },
      ],
    });
    const { metaIntegrationsRoute } = await import("./integrationsMeta.js");
    app = new Hono();
    app.route("/api/integrations/meta", metaIntegrationsRoute);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("handles hub.verify_token subscription handshake", async () => {
    const res = await app.request(
      "/api/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge-123",
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("challenge-123");
  });

  it("rejects subscription with wrong verify token", async () => {
    const res = await app.request(
      "/api/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123",
    );
    expect(res.status).toBe(403);
  });

  it("ingests a signed leadgen webhook payload", async () => {
    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "page-1",
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: "leadgen-999",
                page_id: "page-1",
                form_id: "form-1",
                ad_id: "ad-1",
              },
            },
          ],
        },
      ],
    });

    const res = await app.request("/api/integrations/meta/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signBody(body, "test-app-secret"),
      },
      body,
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EVENT_RECEIVED");

    await vi.waitFor(() => {
      expect(getLeadDetails).toHaveBeenCalledWith("leadgen-999");
      expect(ingestAdLead).toHaveBeenCalled();
    });

    expect(ingestAdLead).toHaveBeenCalled();
    const normalized = ingestAdLead.mock.calls.at(0)?.at(0) as
      | {
          source: string;
          externalLeadId: string;
          fullName: string;
          phone: string;
          email: string;
          adName: string;
          adId: string;
        }
      | undefined;
    expect(normalized).toMatchObject({
      source: "facebook_ads",
      externalLeadId: "leadgen-999",
      fullName: "Jane Doe",
      phone: "+919876543210",
      email: "jane@example.com",
      adName: "Summer Promo",
      adId: "ad-1",
    });
  });

  it("rejects POST webhooks with invalid signature when app secret is set", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const res = await app.request("/api/integrations/meta/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef" },
      body,
    });
    expect(res.status).toBe(403);
    expect(ingestAdLead).not.toHaveBeenCalled();
  });
});
