import type { CallOutcome } from "@propninja/types/enums";

/** Connected talk time only — ring/wall-clock must not be passed here. */
export function outcomeFromTalkSeconds(seconds: number): CallOutcome {
  return seconds > 0 ? "answered" : "no_answer";
}

/**
 * Classify an Android CallLog talk-time read.
 * `null` means the OS row was not found (or not Android) — that is not proof of answer.
 * `0` means the outgoing call exists but the customer never picked up.
 */
export function classifyNativeTalk(nativeSecs: number | null): {
  durationSeconds: number;
  durationIsTalkOnly: boolean;
  outcome: CallOutcome;
} {
  if (nativeSecs == null) {
    return { durationSeconds: 0, durationIsTalkOnly: false, outcome: "no_answer" };
  }
  const durationSeconds = Math.max(0, Math.round(nativeSecs));
  return {
    durationSeconds,
    durationIsTalkOnly: true,
    outcome: outcomeFromTalkSeconds(durationSeconds),
  };
}
