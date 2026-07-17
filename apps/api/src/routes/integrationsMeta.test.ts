import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processLeadgenWebhook = vi.fn(async () => undefined);
const recordWebhookDedupe = vi.fn(async () => ({
  webhookId: "webhook-1",
  alreadyProcessed: false,
}));

vi.mock("../lib/env.js", () => ({
  env: {
    META_VERIFY_TOKEN: "test-verify-token",
    META_APP_SECRET: "test-app-secret",
    PAGE_ACCESS_TOKEN: "page-token",
    NODE_ENV: "test",
  },
}));

vi.mock("../lib/jobQueue.js", () => ({
  isDurableJobsEnabled: () => false,
  enqueueMetaLeadIngest: vi.fn(async () => false),
}));

vi.mock("../services/metaLeadIngestService.js", () => ({
  processLeadgenWebhook,
  recordWebhookDedupe,
}));

vi.mock("../services/adLeadService.js", () => ({
  adLeadService: { ingestAdLead: vi.fn() },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  metaWebhookRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

function signBody(rawBody: string, secret: string) {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

describe("Meta integrations webhook", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    recordWebhookDedupe.mockResolvedValue({
      webhookId: "webhook-1",
      alreadyProcessed: false,
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

  it("queues DB-driven ingest for a signed leadgen webhook payload", async () => {
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
      expect(recordWebhookDedupe).toHaveBeenCalled();
      expect(processLeadgenWebhook).toHaveBeenCalled();
    });

    const change = processLeadgenWebhook.mock.calls.at(0)?.at(0) as
      | { leadgen_id: string; page_id: string; form_id: string; ad_id: string }
      | undefined;
    expect(change).toMatchObject({
      leadgen_id: "leadgen-999",
      page_id: "page-1",
      form_id: "form-1",
      ad_id: "ad-1",
    });
  });

  it("skips already-processed leadgen deliveries", async () => {
    recordWebhookDedupe.mockResolvedValueOnce({
      webhookId: "webhook-1",
      alreadyProcessed: true,
    });

    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "page-1",
          changes: [
            {
              field: "leadgen",
              value: { leadgen_id: "leadgen-dup", page_id: "page-1" },
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
    await vi.waitFor(() => {
      expect(recordWebhookDedupe).toHaveBeenCalled();
    });
    expect(processLeadgenWebhook).not.toHaveBeenCalled();
  });

  it("rejects POST webhooks with invalid signature when app secret is set", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const res = await app.request("/api/integrations/meta/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef" },
      body,
    });
    expect(res.status).toBe(403);
    expect(processLeadgenWebhook).not.toHaveBeenCalled();
  });
});
