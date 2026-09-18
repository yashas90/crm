import { describe, expect, it } from "vitest";
import { API_UNAVAILABLE_MESSAGE, resolveApiErrorFields } from "./common.js";

const notFound = { ok: false, status: 404, statusText: "Not Found" };

describe("resolveApiErrorFields", () => {
  it("reads the standard { ok:false, error:{ code, message } } envelope", () => {
    expect(
      resolveApiErrorFields(
        {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query", details: { a: 1 } },
        },
        notFound,
      ),
    ).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid query",
      details: { a: 1 },
    });
  });

  it("does not throw when error is missing (Railway application-not-found)", () => {
    expect(
      resolveApiErrorFields(
        { status: "error", code: 404, message: "Application not found", request_id: "abc" },
        notFound,
      ),
    ).toEqual({
      code: "API_UNAVAILABLE",
      message: API_UNAVAILABLE_MESSAGE,
    });
  });

  it("maps Railway failed-to-respond bodies", () => {
    expect(
      resolveApiErrorFields(
        { status: "error", code: 502, message: "Application failed to respond" },
        { ok: false, status: 502, statusText: "Bad Gateway" },
      ).message,
    ).toBe(API_UNAVAILABLE_MESSAGE);
  });

  it("uses HTTP_ERROR when the nested error object has no code", () => {
    expect(resolveApiErrorFields({ ok: false, error: { message: "nope" } }, notFound)).toEqual({
      code: "HTTP_ERROR",
      message: "nope",
      details: undefined,
    });
  });

  it("handles HTTP error on an otherwise successful envelope", () => {
    expect(
      resolveApiErrorFields(
        { ok: true, data: {} },
        { ok: false, status: 502, statusText: "Bad Gateway" },
      ),
    ).toEqual({
      code: "HTTP_ERROR",
      message: "Bad Gateway",
    });
  });
});
