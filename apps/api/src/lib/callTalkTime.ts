import { callRecords } from "@propninja/db";
import { type SQL, and, eq, gt, or } from "drizzle-orm";

/** Customer picked up — requires measurable talk time, not just an "answered" label. */
export function answeredCallFilter(): SQL {
  return and(
    or(eq(callRecords.outcome, "answered"), eq(callRecords.disposition, "answered")),
    gt(callRecords.durationSeconds, 0),
  )!;
}

/**
 * Connected calls with measurable talk time — excludes ring/no-answer, busy, and voicemail.
 */
export function connectedTalkTimeFilter(): SQL {
  return answeredCallFilter();
}
