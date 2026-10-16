import { callRecords } from "@propninja/db";
import { EXPLICIT_NON_ANSWER_TOKENS, MIN_TALK_SECONDS } from "@propninja/types/call-metrics";
import { type SQL, and, eq, gte, notInArray, or, sql } from "drizzle-orm";

function notExplicitMiss(column: typeof callRecords.outcome | typeof callRecords.disposition): SQL {
  return sql`lower(coalesce(${column}, '')) not in (${sql.join(
    EXPLICIT_NON_ANSWER_TOKENS.map((token) => sql`${token}`),
    sql`, `,
  )})`;
}

/**
 * Same answered rule as `classifyCall` for a `call_records` row:
 * real conversation duration, and not an explicit miss (no_answer, busy, …).
 */
export function answeredCallFilter(): SQL {
  return and(
    gte(callRecords.durationSeconds, MIN_TALK_SECONDS),
    notInArray(callRecords.status, ["missed", "rejected", "failed"]),
    notExplicitMiss(callRecords.outcome),
    notExplicitMiss(callRecords.disposition),
    or(
      eq(callRecords.outcome, "answered"),
      eq(callRecords.disposition, "answered"),
      eq(callRecords.status, "completed"),
      sql`${callRecords.outcome} in ('interested', 'not_interested', 'callback')`,
    ),
  )!;
}

/** Talk time is the connected duration of answered calls only. */
export function connectedTalkTimeFilter(): SQL {
  return answeredCallFilter();
}

/**
 * Hide a later copy of the same agent + phone + start (±2 seconds).
 * The earlier row is the one that counts.
 */
export function excludeDuplicateCallRecordSql(): SQL {
  return sql`not exists (
    select 1
    from call_records earlier
    where earlier.org_id = ${callRecords.orgId}
      and earlier.user_id = ${callRecords.userId}
      and earlier.id <> ${callRecords.id}
      and length(right(regexp_replace(coalesce(${callRecords.phoneNumber}, ''), '\\D', '', 'g'), 10)) >= 7
      and right(regexp_replace(coalesce(earlier.phone_number, ''), '\\D', '', 'g'), 10)
        = right(regexp_replace(coalesce(${callRecords.phoneNumber}, ''), '\\D', '', 'g'), 10)
      and earlier.started_at >= ${callRecords.startedAt} - interval '2 seconds'
      and earlier.started_at <= ${callRecords.startedAt} + interval '2 seconds'
      and (
        earlier.started_at < ${callRecords.startedAt}
        or (
          earlier.started_at = ${callRecords.startedAt}
          and earlier.id::text < ${callRecords.id}::text
        )
      )
  )`;
}
