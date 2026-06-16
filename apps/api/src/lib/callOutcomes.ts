import type { CallOutcome, CallStatus } from "@propninja/types/enums";
import { CALL_OUTCOMES } from "@propninja/types/enums";

export { CALL_OUTCOMES };
export type { CallOutcome };

export function mapCallOutcome(outcome: CallOutcome): {
  status: CallStatus;
  disposition: string;
} {
  switch (outcome) {
    case "answered":
      return { status: "completed", disposition: "answered" };
    case "no_answer":
      return { status: "missed", disposition: "no_answer" };
    case "busy":
      return { status: "completed", disposition: "busy" };
    case "left_voicemail":
      return { status: "completed", disposition: "left_voicemail" };
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}
