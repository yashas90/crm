import { describe, expect, it } from "vitest";
import { sqlTimestamptz } from "./sqlTimestamp.js";

describe("sqlTimestamptz", () => {
  it("binds an ISO timestamp with an explicit timestamptz cast", () => {
    const fragment = sqlTimestamptz(new Date("2026-07-27T12:00:00.000Z"));
    expect(fragment.queryChunks).toContain("2026-07-27T12:00:00.000Z");
    expect(
      fragment.queryChunks.some(
        (chunk) =>
          typeof chunk === "object" &&
          chunk !== null &&
          "value" in chunk &&
          Array.isArray(chunk.value) &&
          chunk.value.includes("::timestamptz"),
      ),
    ).toBe(true);
  });
});
