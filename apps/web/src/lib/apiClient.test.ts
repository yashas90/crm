import { API_UNAVAILABLE_MESSAGE } from "@propninja/types/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, apiGet } from "./apiClient";

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearSession: vi.fn(),
}));

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiGet error bodies", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ApiRequestError for the standard envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          makeResponse({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404),
        ),
    );
    const err = await apiGet("/api/leads").catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).code).toBe("NOT_FOUND");
    expect((err as ApiRequestError).message).toBe("Lead not found");
  });

  it("does not throw TypeError when gateway JSON has no error.code", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          makeResponse(
            { status: "error", code: 404, message: "Application not found", request_id: "abc" },
            404,
          ),
        ),
    );
    const err = await apiGet("/api/leads").catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).code).toBe("API_UNAVAILABLE");
    expect((err as ApiRequestError).message).toBe(API_UNAVAILABLE_MESSAGE);
  });
});
