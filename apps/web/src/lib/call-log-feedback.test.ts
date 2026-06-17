import { describe, expect, it } from "vitest";
import { callLogSuccessMessageWeb } from "./call-log-feedback";

describe("callLogSuccessMessageWeb", () => {
  it("mentions 2 hours for no_answer and busy", () => {
    expect(callLogSuccessMessageWeb("no_answer")).toContain("2 hours");
    expect(callLogSuccessMessageWeb("busy")).toContain("2 hours");
  });

  it("mentions 24 hours for voicemail", () => {
    expect(callLogSuccessMessageWeb("left_voicemail")).toContain("24 hours");
  });

  it("returns simple message for answered", () => {
    expect(callLogSuccessMessageWeb("answered")).toBe("Call logged");
  });
});
