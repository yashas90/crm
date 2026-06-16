import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentryScrub";

describe("scrubSentryEvent (web)", () => {
  it("filters sensitive request fields", () => {
    const event = {
      request: {
        headers: { cookie: "session=abc" },
        data: { token: "jwt-value", title: "hello" },
      },
    };

    const scrubbed = scrubSentryEvent(event as Parameters<typeof scrubSentryEvent>[0]);
    expect(scrubbed?.request?.headers?.cookie).toBe("[Filtered]");
    expect(scrubbed?.request?.data).toEqual({ token: "[Filtered]", title: "hello" });
  });
});
