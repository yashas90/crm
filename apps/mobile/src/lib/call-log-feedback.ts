import type { CallOutcome } from "@propninja/types/enums";

export function callLogSuccessMessage(outcome: CallOutcome): string {
  if (outcome === "no_answer" || outcome === "busy") {
    return "Call logged ✓  Follow-up task created for 2hrs";
  }
  if (outcome === "left_voicemail") {
    return "Call logged ✓  Follow-up task created for 24hrs";
  }
  return "Call logged ✓";
}

export function callLogSuccessMessageWeb(outcome: CallOutcome): string {
  if (outcome === "no_answer" || outcome === "busy") {
    return "Call logged. Follow-up task created for 2 hours.";
  }
  if (outcome === "left_voicemail") {
    return "Call logged. Follow-up task created for 24 hours.";
  }
  return "Call logged";
}
