import { callRecords } from "@propninja/db";
import { and, eq, gt, or } from "drizzle-orm";

/** Customer picked up — includes zero-duration edge cases for call counts. */
export function answeredCallFilter() {
  return or(eq(callRecords.outcome, "answered"), eq(callRecords.disposition, "answered"));
}

/**
 * Connected calls with measurable talk time — excludes ring/no-answer, busy, and voicemail.
 */
export function connectedTalkTimeFilter() {
  return and(answeredCallFilter(), gt(callRecords.durationSeconds, 0));
}
