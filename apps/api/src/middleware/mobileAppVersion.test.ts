import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/env.js", () => ({
  env: {
    MIN_MOBILE_APP_VERSION: undefined as string | undefined,
    MOBILE_UPDATE_URL: undefined as string | undefined,
  },
}));

import { env } from "../lib/env.js";
import { mobileAppVersionMiddleware } from "./mobileAppVersion.js";

function buildApp() {
  const app = new Hono();
  app.use("/api/*", mobileAppVersionMiddleware);
  app.get("/api/leads", (c) => c.json({ ok: true }));
  app.post("/api/integrations/meta/webhook", (c) => c.json({ ok: true }));
  return app;
}

describe("mobileAppVersionMiddleware", () => {
  afterEach(() => {
    env.MIN_MOBILE_APP_VERSION = undefined;
    env.MOBILE_UPDATE_URL = undefined;
  });

  it("allows all clients when min version is unset", async () => {
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: { "X-PropNinja-Client": "mobile", "X-PropNinja-App-Version": "1.0.0" },
    });
    expect(res.status).toBe(200);
  });

  it("allows web browsers when min version is set", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.5";
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      },
    });
    expect(res.status).toBe(200);
  });

  it("blocks outdated mobile clients", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.5";
    env.MOBILE_UPDATE_URL = "https://example.com/update";
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: {
        "X-PropNinja-Client": "mobile",
        "X-PropNinja-App-Version": "1.0.4",
      },
    });
    expect(res.status).toBe(426);
    const body = (await res.json()) as {
      ok: false;
      error: { code: string; details: { minMobileAppVersion: string } };
    };
    expect(body.error.code).toBe("APP_UPDATE_REQUIRED");
    expect(body.error.details.minMobileAppVersion).toBe("1.0.5");
  });

  it("blocks native clients that omit the version header", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.5";
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: { "User-Agent": "okhttp/4.9.2" },
    });
    expect(res.status).toBe(426);
  });

  it("blocks clients below the current 1.0.8 floor", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.8";
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: {
        "X-PropNinja-Client": "mobile",
        "X-PropNinja-App-Version": "1.0.7",
      },
    });
    expect(res.status).toBe(426);
  });

  it("allows current mobile clients", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.8";
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: {
        "X-PropNinja-Client": "mobile",
        "X-PropNinja-App-Version": "1.0.8",
      },
    });
    expect(res.status).toBe(200);
  });

  it("allows empty string to disable enforcement", async () => {
    env.MIN_MOBILE_APP_VERSION = "";
    const app = buildApp();
    const res = await app.request("/api/leads", {
      headers: { "User-Agent": "okhttp/4.9.2" },
    });
    expect(res.status).toBe(200);
  });

  it("skips integration webhooks", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.8";
    const app = buildApp();
    const res = await app.request("/api/integrations/meta/webhook", {
      method: "POST",
      headers: { "User-Agent": "okhttp/4.9.2" },
    });
    expect(res.status).toBe(200);
  });

  it("allows outdated mobile clients to upload location telemetry", async () => {
    env.MIN_MOBILE_APP_VERSION = "1.0.14";
    const app = new Hono();
    app.use("/api/*", mobileAppVersionMiddleware);
    app.post("/api/locations/ping", (c) => c.json({ ok: true }));
    app.post("/api/auth/refresh", (c) => c.json({ ok: true }));
    const ping = await app.request("/api/locations/ping", {
      method: "POST",
      headers: {
        "X-PropNinja-Client": "mobile",
        "X-PropNinja-App-Version": "1.0.9",
      },
    });
    expect(ping.status).toBe(200);
    const refresh = await app.request("/api/auth/refresh", {
      method: "POST",
      headers: {
        "X-PropNinja-Client": "mobile",
        "X-PropNinja-App-Version": "1.0.9",
      },
    });
    expect(refresh.status).toBe(200);
  });
});
