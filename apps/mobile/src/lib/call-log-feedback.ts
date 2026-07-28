import type { CallOutcome } from "@propninja/types/enums";

export function callLogSuccessMessage(_outcome: CallOutcome): string {
  return "Call logged ✓";
}

export function callLogSuccessMessageWeb(_outcome: CallOutcome): string {
  return "Call logged";
}
