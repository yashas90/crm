import { describe, expect, it } from "vitest";
import { callLogSuccessMessageWeb } from "./call-log-feedback";

describe("callLogSuccessMessageWeb", () => {
  it("returns simple message for all outcomes", () => {
    expect(callLogSuccessMessageWeb("no_answer")).toBe("Call logged");
    expect(callLogSuccessMessageWeb("busy")).toBe("Call logged");
    expect(callLogSuccessMessageWeb("left_voicemail")).toBe("Call logged");
    expect(callLogSuccessMessageWeb("answered")).toBe("Call logged");
  });
});
