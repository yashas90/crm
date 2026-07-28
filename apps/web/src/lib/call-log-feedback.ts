import type { CallOutcome } from "@propninja/types/enums";

export function callLogSuccessMessageWeb(_outcome: CallOutcome): string {
  return "Call logged";
}
