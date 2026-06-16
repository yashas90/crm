import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentryScrub.js";

describe("scrubSentryEvent", () => {
  it("filters authorization headers and phone numbers", () => {
    const event = {
      message: "Call failed for +919876543210",
      request: {
        headers: {
          authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
          "content-type": "application/json",
        },
        data: {
          password: "secret123",
          phone: "+919876543210",
          note: "ok",
        },
      },
    };

    const scrubbed = scrubSentryEvent(event as unknown as Parameters<typeof scrubSentryEvent>[0]);
    expect(scrubbed?.request?.headers?.authorization).toBe("[Filtered]");
    expect(scrubbed?.request?.data).toEqual({
      password: "[Filtered]",
      phone: "[Filtered]",
      note: "ok",
    });
    expect(scrubbed?.message).toBe("Call failed for [Filtered]");
  });
});
