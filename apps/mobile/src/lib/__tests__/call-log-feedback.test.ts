import type { CallOutcome } from "@propninja/types/enums";
import { callLogSuccessMessage } from "../call-log-feedback";

describe("callLogSuccessMessage", () => {
  const outcomes: CallOutcome[] = ["no_answer", "busy", "left_voicemail", "answered"];

  it.each(outcomes)("returns simple logged message for %s", (outcome) => {
    expect(callLogSuccessMessage(outcome)).toBe("Call logged ✓");
  });
});
