import type { CallOutcome } from "@propninja/types/enums";
import { callLogSuccessMessage } from "../call-log-feedback";

describe("callLogSuccessMessage", () => {
  const cases: Array<{ outcome: CallOutcome; expected: string }> = [
    {
      outcome: "no_answer",
      expected: "Call logged ✓  Follow-up task created for 2hrs",
    },
    {
      outcome: "busy",
      expected: "Call logged ✓  Follow-up task created for 2hrs",
    },
    {
      outcome: "left_voicemail",
      expected: "Call logged ✓  Follow-up task created for 24hrs",
    },
    {
      outcome: "answered",
      expected: "Call logged ✓",
    },
  ];

  it.each(cases)("returns expected message for $outcome", ({ outcome, expected }) => {
    expect(callLogSuccessMessage(outcome)).toBe(expected);
  });
});
