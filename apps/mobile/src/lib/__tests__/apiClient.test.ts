jest.mock("@/lib/apiBaseUrl", () => ({ getApiBaseUrl: () => "https://api.test" }));
jest.mock("@/lib/auth", () => ({ getToken: jest.fn().mockReturnValue(null) }));

import {
  ApiRequestError,
  QueuedOfflineError,
  apiGet,
  apiPost,
  isQueuedOfflineError,
} from "@/lib/apiClient";
import { getToken } from "@/lib/auth";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiGet / apiPost success path", () => {
  beforeEach(() => {
    mockGetToken.mockReturnValue("test-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves with data on ok response", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeResponse({ ok: true, data: { id: "1" } }));
    const result = await apiGet<{ id: string }>("/api/test");
    expect(result).toEqual({ id: "1" });
  });

  it("sends Authorization header when token present", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeResponse({ ok: true, data: {} }));
    await apiGet("/api/test");
    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>)?.Authorization).toBe("Bearer test-token");
  });

  it("omits Authorization header when no token", async () => {
    mockGetToken.mockReturnValue(null);
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeResponse({ ok: true, data: {} }));
    await apiGet("/api/test");
    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>)?.Authorization).toBeUndefined();
  });

  it("throws ApiRequestError on API error response", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, 404),
      );
    await expect(apiGet("/api/missing")).rejects.toThrow(ApiRequestError);
  });

  it("thrown error carries code and status", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse({ ok: false, error: { code: "FORBIDDEN", message: "No access" } }, 403),
      );
    const err = await apiGet("/api/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).code).toBe("FORBIDDEN");
    expect((err as ApiRequestError).status).toBe(403);
  });

  it("throws NETWORK_ERROR when fetch rejects", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));
    // retry once on transient — mock second call too
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));
    const err = await apiGet("/api/x").catch((e) => e);
    expect((err as ApiRequestError).code).toBe("NETWORK_ERROR");
  });

  it("apiPost sends JSON body", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeResponse({ ok: true, data: { created: true } }));
    await apiPost("/api/leads", { name: "Test" });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ name: "Test" }));
  });
});

describe("QueuedOfflineError", () => {
  it("is instanceof QueuedOfflineError", () => {
    const err = new QueuedOfflineError("offline");
    expect(err).toBeInstanceOf(QueuedOfflineError);
    expect(err.name).toBe("QueuedOfflineError");
  });

  it("isQueuedOfflineError returns true", () => {
    expect(isQueuedOfflineError(new QueuedOfflineError("x"))).toBe(true);
  });

  it("isQueuedOfflineError returns false for plain Error", () => {
    expect(isQueuedOfflineError(new Error("x"))).toBe(false);
  });
});
