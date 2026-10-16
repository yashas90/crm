import { hasMeasurableTalk } from "@propninja/types/call-metrics";
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

/**
 * Answered requires connected talk time of at least MIN_TALK_SECONDS.
 * Shorter "answered" rows are ringing, carrier, or voicemail artifacts.
 */
export function normalizeLoggedCall(input: {
  outcome: CallOutcome;
  durationSeconds: number;
}): {
  outcome: CallOutcome;
  durationSeconds: number;
  status: CallStatus;
  disposition: string;
} {
  const raw = Number(input.durationSeconds);
  const durationSeconds = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  const outcome =
    input.outcome === "answered" && !hasMeasurableTalk(durationSeconds)
      ? "no_answer"
      : input.outcome;
  const mapped = mapCallOutcome(outcome);
  return { outcome, durationSeconds, ...mapped };
}
