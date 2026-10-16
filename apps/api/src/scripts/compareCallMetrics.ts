import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * One-off: compare the previous call-report rules with the shared classifier
 * for one IST day. Default day is 2026-10-16.
 *
 *   pnpm --filter @propninja/api exec tsx src/scripts/compareCallMetrics.ts
 *   pnpm --filter @propninja/api exec tsx src/scripts/compareCallMetrics.ts 2026-10-16
 */
import { config } from "dotenv";
import type {
  CombinedCallStats,
  DataCallForStats,
  DeviceCallForStats,
  LeadCallForStats,
} from "../lib/combinedCallStats.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, "../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const { users } = await import("@propninja/db");
const { istDateKeyBounds } = await import("@propninja/types/ist");
const { eq, sql } = await import("drizzle-orm");
const { SINGLE_TENANT_ORG_ID } = await import("../lib/constants.js");
const { db } = await import("../lib/db.js");
const { loadCombinedCallInputs } = await import("../lib/loadCombinedCallEvents.js");
const {
  aggregateCombinedCalls,
  callPhoneKey,
  classifyDataCall,
  classifyDeviceCall,
  classifyLeadCall,
} = await import("../lib/combinedCallStats.js");

const LEGACY_WINDOW_MS = 2 * 60 * 1000;
const DATA_CONVERSATION = new Set(["interested", "not_interested", "callback"]);

type LegacyEvent = {
  userId: string;
  phoneKey: string | null;
  startedAtMs: number;
  direction: "incoming" | "outgoing";
  kind: "answered" | "missed" | "not_connected";
  durationSeconds: number;
  sourceRank: number;
};

function clamp(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function legacyLead(input: LeadCallForStats): LegacyEvent {
  const duration = clamp(input.durationSeconds);
  const direction = input.direction === "incoming" ? "incoming" : "outgoing";
  const labeled = input.outcome === "answered" || input.disposition === "answered";
  const explicitMiss = input.status === "missed" || input.status === "rejected";
  const answered = labeled && duration > 0 && !explicitMiss;
  return {
    userId: input.userId,
    phoneKey: callPhoneKey(input.phone),
    startedAtMs: input.startedAt.getTime(),
    direction,
    kind:
      direction === "incoming"
        ? answered
          ? "answered"
          : "missed"
        : answered
          ? "answered"
          : "not_connected",
    durationSeconds: answered ? duration : 0,
    sourceRank: 0,
  };
}

function legacyData(input: DataCallForStats): LegacyEvent {
  const duration = clamp(input.durationSeconds);
  const answered = duration > 0 || DATA_CONVERSATION.has(input.outcome);
  return {
    userId: input.userId,
    phoneKey: callPhoneKey(input.phone),
    startedAtMs: input.calledAt.getTime(),
    direction: "outgoing",
    kind: answered ? "answered" : "not_connected",
    durationSeconds: duration > 0 ? duration : 0,
    sourceRank: 1,
  };
}

function legacyDevice(input: DeviceCallForStats): LegacyEvent {
  const type = input.callType.trim().toUpperCase();
  const duration = clamp(input.durationSeconds);
  let direction: "incoming" | "outgoing" = "outgoing";
  let kind: LegacyEvent["kind"] = "not_connected";
  let stored = 0;
  if (type === "MISSED" || type === "REJECTED") {
    direction = "incoming";
    kind = "missed";
  } else if (type === "INCOMING") {
    direction = "incoming";
    if (duration > 0) {
      kind = "answered";
      stored = duration;
    } else {
      kind = "missed";
    }
  } else if (duration > 0) {
    kind = "answered";
    stored = duration;
  }
  return {
    userId: input.userId,
    phoneKey: callPhoneKey(input.phone),
    startedAtMs: input.startedAt.getTime(),
    direction,
    kind,
    durationSeconds: stored,
    sourceRank: 2,
  };
}

function mergeLegacy(target: LegacyEvent, extra: LegacyEvent) {
  const duration = Math.max(target.durationSeconds, extra.durationSeconds);
  const answered = target.kind === "answered" || extra.kind === "answered" || duration > 0;
  target.sourceRank = Math.min(target.sourceRank, extra.sourceRank);
  if (answered) {
    target.kind = "answered";
    target.durationSeconds = duration;
    return;
  }
  target.kind = target.direction === "incoming" ? "missed" : "not_connected";
  target.durationSeconds = 0;
}

function dedupeLegacy(events: LegacyEvent[]): LegacyEvent[] {
  const keyed = events.filter((event) => event.phoneKey);
  const unkeyed = events.filter((event) => !event.phoneKey).map((event) => ({ ...event }));
  keyed.sort((a, b) => {
    if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
    if (a.phoneKey !== b.phoneKey) return (a.phoneKey ?? "") < (b.phoneKey ?? "") ? -1 : 1;
    if (a.direction !== b.direction) return a.direction < b.direction ? -1 : 1;
    return a.startedAtMs - b.startedAtMs;
  });
  const kept: LegacyEvent[] = [];
  for (const event of keyed) {
    const previous = kept[kept.length - 1];
    if (
      previous &&
      previous.userId === event.userId &&
      previous.phoneKey === event.phoneKey &&
      previous.direction === event.direction &&
      event.startedAtMs - previous.startedAtMs <= LEGACY_WINDOW_MS
    ) {
      mergeLegacy(previous, event);
      continue;
    }
    kept.push({ ...event });
  }
  return [...kept, ...unkeyed];
}

function countLegacy(events: LegacyEvent[]): Map<string, CombinedCallStats> {
  const byUser = new Map<string, { stats: CombinedCallStats; talk: number[] }>();
  for (const event of dedupeLegacy(events)) {
    let draft = byUser.get(event.userId);
    if (!draft) {
      draft = { stats: emptyStats(), talk: [] };
      byUser.set(event.userId, draft);
    }
    const stats = draft.stats;
    if (event.direction === "incoming") {
      stats.incomingTotal += 1;
      if (event.kind === "answered") {
        stats.incomingAnswered += 1;
        if (event.durationSeconds > 0) draft.talk.push(event.durationSeconds);
      } else {
        stats.incomingMissed += 1;
      }
    } else {
      stats.outgoingTotal += 1;
      if (event.kind === "answered") {
        stats.outgoingAnswered += 1;
        if (event.durationSeconds > 0) draft.talk.push(event.durationSeconds);
      } else {
        stats.outgoingNotConnected += 1;
      }
    }
    stats.totalCalls = stats.incomingTotal + stats.outgoingTotal;
  }

  const result = new Map<string, CombinedCallStats>();
  for (const [userId, draft] of byUser) {
    const positive = draft.talk.filter((seconds) => seconds > 0);
    const totalTalk = positive.reduce((sum, seconds) => sum + seconds, 0);
    draft.stats.totalTalkTimeSeconds = totalTalk;
    draft.stats.avgTalkTimeSeconds =
      positive.length > 0 ? Math.round(totalTalk / positive.length) : 0;
    draft.stats.minTalkTimeSeconds = positive.length > 0 ? Math.min(...positive) : 0;
    draft.stats.maxTalkTimeSeconds = positive.length > 0 ? Math.max(...positive) : 0;
    result.set(userId, draft.stats);
  }
  return result;
}

type MetricKey =
  | "incomingAnswered"
  | "incomingMissed"
  | "incomingTotal"
  | "outgoingAnswered"
  | "outgoingNotConnected"
  | "outgoingTotal"
  | "totalCalls"
  | "totalTalkTimeSeconds"
  | "avgTalkTimeSeconds"
  | "minTalkTimeSeconds"
  | "maxTalkTimeSeconds";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "incomingAnswered", label: "Incoming answered" },
  { key: "incomingMissed", label: "Incoming missed" },
  { key: "incomingTotal", label: "Incoming total" },
  { key: "outgoingAnswered", label: "Outgoing answered" },
  { key: "outgoingNotConnected", label: "Outgoing not connected" },
  { key: "outgoingTotal", label: "Outgoing total" },
  { key: "totalCalls", label: "Total calls" },
  { key: "totalTalkTimeSeconds", label: "Total talk sec" },
  { key: "avgTalkTimeSeconds", label: "Avg talk sec" },
  { key: "minTalkTimeSeconds", label: "Min talk sec" },
  { key: "maxTalkTimeSeconds", label: "Max talk sec" },
];

function emptyStats(): CombinedCallStats {
  return {
    incomingAnswered: 0,
    incomingMissed: 0,
    incomingTotal: 0,
    incomingDurationSeconds: 0,
    outgoingAnswered: 0,
    outgoingNotConnected: 0,
    outgoingTotal: 0,
    outgoingDurationSeconds: 0,
    outgoingNotAnswered: 0,
    totalCalls: 0,
    connected: 0,
    totalTalkTimeSeconds: 0,
    totalDurationSeconds: 0,
    avgTalkTimeSeconds: 0,
    minTalkTimeSeconds: 0,
    maxTalkTimeSeconds: 0,
  };
}

function addStats(target: CombinedCallStats, row: CombinedCallStats) {
  target.incomingAnswered += row.incomingAnswered;
  target.incomingMissed += row.incomingMissed;
  target.incomingTotal += row.incomingTotal;
  target.outgoingAnswered += row.outgoingAnswered;
  target.outgoingNotConnected += row.outgoingNotConnected;
  target.outgoingTotal += row.outgoingTotal;
  target.totalCalls += row.totalCalls;
  target.totalTalkTimeSeconds += row.totalTalkTimeSeconds;
}

function pad(value: string, width: number) {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width, " ");
}

const dateKey = process.argv[2] ?? "2026-10-16";
const bounds = istDateKeyBounds(dateKey);

const people = await db
  .select({ id: users.id, name: users.name })
  .from(users)
  .where(eq(users.orgId, SINGLE_TENANT_ORG_ID));

const userIdsForLoad = people.map((person) => person.id);
let includeDataCalls = true;
let includeDeviceCalls = true;
const inputs = await loadSafely();

async function loadSafely() {
  try {
    return await loadCombinedCallInputs(db, {
      from: bounds.start,
      to: bounds.end,
      userIds: userIdsForLoad,
      includeDataCalls,
      includeDeviceCalls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (includeDataCalls && message.includes("contact_call_logs")) {
      includeDataCalls = false;
      console.log(
        "contact_call_logs is not in this database; data calls are omitted from both counts.",
      );
      return loadSafely();
    }
    if (includeDeviceCalls && message.includes("agent_call_logs")) {
      includeDeviceCalls = false;
      console.log(
        "agent_call_logs is not in this database; device calls are omitted from both counts.",
      );
      return loadSafely();
    }
    throw error;
  }
}

const legacyByUser = countLegacy([
  ...inputs.lead.map(legacyLead),
  ...inputs.data.map(legacyData),
  ...inputs.device.map(legacyDevice),
]);
const nextByUser = aggregateCombinedCalls([
  ...inputs.lead.map(classifyLeadCall),
  ...inputs.data.map(classifyDataCall),
  ...inputs.device.map(classifyDeviceCall),
]).byUser;

const names = new Map(people.map((person) => [person.id, person.name]));
const userIds = [...new Set([...legacyByUser.keys(), ...nextByUser.keys()])].sort((a, b) =>
  (names.get(a) ?? a).localeCompare(names.get(b) ?? b),
);

console.log(
  `Call metrics ${dateKey} (Asia/Kolkata ${bounds.start.toISOString()} → ${bounds.end.toISOString()})`,
);
console.log(
  `Source rows: lead ${inputs.lead.length}, data ${inputs.data.length}, device ${inputs.device.length}`,
);
if (inputs.lead.length === 0 && inputs.device.length === 0) {
  const { sqlRows } = await import("../lib/contactPool/sql.js");
  const span = sqlRows(
    await db.execute(sql`
      select count(*)::int as call_rows,
        min(started_at) as first_call,
        max(started_at) as last_call
      from call_records
    `),
  )[0];
  const deviceSpan = sqlRows(
    await db.execute(sql`
      select count(*)::int as device_rows,
        min(call_start_time) as first_call,
        max(call_start_time) as last_call
      from agent_call_logs
    `),
  )[0];
  console.log(
    `Database span: call_records ${span?.call_rows ?? 0} rows (${span?.first_call ?? "none"} → ${span?.last_call ?? "none"})`,
  );
  console.log(
    `Database span: agent_call_logs ${deviceSpan?.device_rows ?? 0} rows (${deviceSpan?.first_call ?? "none"} → ${deviceSpan?.last_call ?? "none"})`,
  );
}
console.log("Old: duration > 0 and an answered label, duplicates merged inside 2 minutes.");
console.log(
  "New: talk >= MIN_TALK_SECONDS (default 3), duplicates inside ±2s or the same device call-log id.",
);
console.log("");
console.log(`${pad("User", 28)} ${pad("Metric", 26)} ${pad("Old", 8)} ${pad("New", 8)} Diff`);

const oldTotal = emptyStats();
const newTotal = emptyStats();
let changedUsers = 0;

for (const userId of userIds) {
  const oldRow = legacyByUser.get(userId) ?? emptyStats();
  const newRow = nextByUser.get(userId) ?? emptyStats();
  addStats(oldTotal, oldRow);
  addStats(newTotal, newRow);
  const changed = METRICS.some((metric) => oldRow[metric.key] !== newRow[metric.key]);
  if (!changed && oldRow.totalCalls === 0 && newRow.totalCalls === 0) continue;
  if (changed) changedUsers += 1;
  const name = names.get(userId) ?? userId;
  for (const metric of METRICS) {
    const oldValue = oldRow[metric.key];
    const newValue = newRow[metric.key];
    const diff = newValue - oldValue;
    if (diff === 0 && !changed) continue;
    console.log(
      `${pad(name, 28)} ${pad(metric.label, 26)} ${pad(String(oldValue), 8)} ${pad(String(newValue), 8)} ${diff > 0 ? "+" : ""}${diff}`,
    );
  }
}

const answeredOld = oldTotal.incomingAnswered + oldTotal.outgoingAnswered;
const answeredNew = newTotal.incomingAnswered + newTotal.outgoingAnswered;
oldTotal.avgTalkTimeSeconds =
  answeredOld > 0 ? Math.round(oldTotal.totalTalkTimeSeconds / answeredOld) : 0;
newTotal.avgTalkTimeSeconds =
  answeredNew > 0 ? Math.round(newTotal.totalTalkTimeSeconds / answeredNew) : 0;

console.log("");
console.log("TOTAL (sum of user rows; avg = total talk / answered)");
for (const metric of METRICS) {
  if (metric.key === "minTalkTimeSeconds" || metric.key === "maxTalkTimeSeconds") continue;
  const oldValue = oldTotal[metric.key];
  const newValue = newTotal[metric.key];
  const diff = newValue - oldValue;
  console.log(
    `${pad("Total", 28)} ${pad(metric.label, 26)} ${pad(String(oldValue), 8)} ${pad(String(newValue), 8)} ${diff > 0 ? "+" : ""}${diff}`,
  );
}
console.log("");
console.log(`Users with a difference: ${changedUsers} of ${userIds.length}`);

process.exit(0);
