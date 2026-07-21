import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({ logger }));

describe("requestContextMiddleware slow requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("emits request.slow when duration exceeds the threshold", async () => {
    const { requestContextMiddleware, SLOW_REQUEST_MS } = await import("./requestContext.js");
    const app = new Hono();
    app.use("*", requestContextMiddleware);
    app.get("/api/leads", async (c) => {
      vi.advanceTimersByTime(SLOW_REQUEST_MS + 5);
      return c.json({ ok: true });
    });

    await app.request("/api/leads");

    expect(logger.warn).toHaveBeenCalledWith(
      "request.slow",
      expect.objectContaining({
        path: "/api/leads",
        method: "GET",
      }),
    );
  });
});
