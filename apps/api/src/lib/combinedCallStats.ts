/**
 * One calling report for lead calls (`call_records`), data calls
 * (`contact_call_logs`), and phone-log rows (`agent_call_logs`).
 *
 * Classification goes through `classifyCall`. One dial is one row:
 * - the same device call-log id
 * - a second copy of that app log, or that phone log, within ±2 seconds
 * - an app row written after the phone log for the same agent and phone
 *
 * The phone log is the call that happened. The app writes its copy when the agent
 * returns, which for an unanswered call is minutes after the phone started ringing.
 * Two phone-log rows more than 2 seconds apart stay two calls. A redial is a new call.
 */

import {
  CALL_CROSS_SOURCE_WINDOW_MS,
  CALL_DEDUPE_WINDOW_MS,
  type CallMetricKind,
  classifyCall,
} from "@propninja/types/call-metrics";

export const COMBINED_CALL_MATCH_WINDOW_MS = CALL_CROSS_SOURCE_WINDOW_MS;

export type CombinedCallDirection = "incoming" | "outgoing";
export type CombinedCallKind = CallMetricKind;

export type CombinedCallEvent = {
  userId: string;
  phoneKey: string | null;
  startedAtMs: number;
  direction: CombinedCallDirection;
  kind: CombinedCallKind;
  /** Conversation seconds. 0 when the call is not answered. */
  durationSeconds: number;
  /** 0 lead, 1 data, 2 device. Lower rank is the canonical app log. */
  sourceRank: number;
  deviceCallLogId: string | null;
  hasLead: boolean;
};

export type LeadCallForStats = {
  userId: string;
  phone: string | null;
  startedAt: Date;
  direction: string;
  status: string;
  outcome: string | null;
  disposition: string | null;
  durationSeconds: number;
  hasLead?: boolean;
};

export type DataCallForStats = {
  userId: string;
  phone: string | null;
  calledAt: Date;
  outcome: string;
  durationSeconds: number;
};

export type DeviceCallForStats = {
  userId: string;
  phone: string | null;
  callType: string;
  startedAt: Date;
  durationSeconds: number | null;
  callLogId?: string | null;
};

export type CombinedCallStats = {
  incomingAnswered: number;
  incomingMissed: number;
  incomingTotal: number;
  incomingDurationSeconds: number;
  outgoingAnswered: number;
  outgoingNotConnected: number;
  outgoingTotal: number;
  outgoingDurationSeconds: number;
  outgoingNotAnswered: number;
  totalCalls: number;
  connected: number;
  totalTalkTimeSeconds: number;
  totalDurationSeconds: number;
  avgTalkTimeSeconds: number;
  minTalkTimeSeconds: number;
  maxTalkTimeSeconds: number;
};

export type CallCountTotals = {
  incomingAnswered: number;
  incomingMissed: number;
  incomingTotal: number;
  outgoingAnswered: number;
  outgoingNotConnected: number;
  outgoingTotal: number;
  totalTalkTimeSeconds: number;
  avgTalkTimeSeconds: number;
  minTalkTimeSeconds: number;
  maxTalkTimeSeconds: number;
  totalCalls: number;
};

export function callPhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function eventFromClassification(
  input: {
    userId: string;
    phone: string | null;
    startedAt: Date;
    sourceRank: number;
    deviceCallLogId?: string | null;
    hasLead?: boolean;
  },
  classified: ReturnType<typeof classifyCall>,
): CombinedCallEvent {
  return {
    userId: input.userId,
    phoneKey: callPhoneKey(input.phone),
    startedAtMs: input.startedAt.getTime(),
    direction: classified.direction,
    kind: classified.kind,
    durationSeconds: classified.talkSeconds,
    sourceRank: input.sourceRank,
    deviceCallLogId: input.deviceCallLogId?.trim() || null,
    hasLead: input.hasLead ?? false,
  };
}

export function classifyLeadCall(input: LeadCallForStats): CombinedCallEvent {
  return eventFromClassification(
    {
      userId: input.userId,
      phone: input.phone,
      startedAt: input.startedAt,
      sourceRank: 0,
      hasLead: input.hasLead ?? false,
    },
    classifyCall({
      direction: input.direction,
      durationSeconds: input.durationSeconds,
      outcome: input.outcome,
      disposition: input.disposition,
      status: input.status,
    }),
  );
}

export function classifyDataCall(input: DataCallForStats): CombinedCallEvent {
  return eventFromClassification(
    {
      userId: input.userId,
      phone: input.phone,
      startedAt: input.calledAt,
      sourceRank: 1,
    },
    classifyCall({
      direction: "outgoing",
      durationSeconds: input.durationSeconds,
      outcome: input.outcome,
    }),
  );
}

export function classifyDeviceCall(input: DeviceCallForStats): CombinedCallEvent {
  return eventFromClassification(
    {
      userId: input.userId,
      phone: input.phone,
      startedAt: input.startedAt,
      sourceRank: 2,
      deviceCallLogId: input.callLogId,
    },
    classifyCall({
      durationSeconds: input.durationSeconds,
      callType: input.callType,
    }),
  );
}

function mergeInto(target: CombinedCallEvent, extra: CombinedCallEvent) {
  if (extra.deviceCallLogId && !target.deviceCallLogId) {
    target.deviceCallLogId = extra.deviceCallLogId;
  }
  target.hasLead = target.hasLead || extra.hasLead;
  const talk = Math.max(target.durationSeconds, extra.durationSeconds);
  const answered = target.kind === "answered" || extra.kind === "answered";
  if (extra.sourceRank < target.sourceRank && !answered) {
    target.direction = extra.direction;
  }
  if (answered) {
    if (
      extra.kind === "answered" &&
      (target.kind !== "answered" || extra.sourceRank < target.sourceRank)
    ) {
      target.direction = extra.direction;
    }
    target.kind = "answered";
    target.durationSeconds = talk;
  } else {
    target.durationSeconds = 0;
    target.kind = target.direction === "incoming" ? "missed" : "not_connected";
  }
  target.sourceRank = Math.min(target.sourceRank, extra.sourceRank);
}

function samePhoneMoment(previous: CombinedCallEvent, event: CombinedCallEvent): boolean {
  return (
    previous.userId === event.userId &&
    previous.phoneKey === event.phoneKey &&
    Math.abs(event.startedAtMs - previous.startedAtMs) <= CALL_DEDUPE_WINDOW_MS
  );
}

function isDeviceEvent(event: CombinedCallEvent): boolean {
  return event.sourceRank === 2 || Boolean(event.deviceCallLogId);
}

/** Collapse double-submitted rows of one source. A later redial stays its own call. */
function collapseSameMoment(events: CombinedCallEvent[]): CombinedCallEvent[] {
  const keyed: CombinedCallEvent[] = [];
  const unkeyed: CombinedCallEvent[] = [];
  for (const event of events) {
    if (event.phoneKey) keyed.push(event);
    else unkeyed.push({ ...event });
  }

  keyed.sort((a, b) => {
    if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
    if (a.phoneKey !== b.phoneKey) return (a.phoneKey ?? "") < (b.phoneKey ?? "") ? -1 : 1;
    return a.startedAtMs - b.startedAtMs;
  });

  const kept: CombinedCallEvent[] = [];
  for (const event of keyed) {
    const previous = kept[kept.length - 1];
    if (previous && samePhoneMoment(previous, event)) {
      mergeInto(previous, event);
      continue;
    }
    kept.push({ ...event });
  }

  return [...kept, ...unkeyed];
}

/** Dial-pad stamps can sit a few seconds before the phone's own clock. */
const PHONE_LOG_CLOCK_SKEW_MS = 15_000;

/**
 * The app row belongs to this phone call when it was written after the phone
 * started the call, and before the return window closed.
 */
function appLogMatchesPhoneCall(app: CombinedCallEvent, phoneCall: CombinedCallEvent): boolean {
  const talkMs = Math.max(0, phoneCall.durationSeconds) * 1000;
  const earliest = phoneCall.startedAtMs - PHONE_LOG_CLOCK_SKEW_MS;
  const latest = phoneCall.startedAtMs + talkMs + CALL_CROSS_SOURCE_WINDOW_MS;
  return app.startedAtMs >= earliest && app.startedAtMs <= latest;
}

/**
 * Collapse logs of one phone event.
 * Phone-log rows are the calls that happened. An app or data row for the same
 * agent and number is that dial when it was written on the way back to the app.
 */
export function dedupeCombinedCalls(events: CombinedCallEvent[]): CombinedCallEvent[] {
  const byDevice = new Map<string, CombinedCallEvent>();
  const withoutDeviceId: CombinedCallEvent[] = [];

  for (const event of events) {
    if (!event.deviceCallLogId) {
      withoutDeviceId.push(event);
      continue;
    }
    const key = `${event.userId}:${event.deviceCallLogId}`;
    const existing = byDevice.get(key);
    if (existing) {
      if (event.startedAtMs < existing.startedAtMs) existing.startedAtMs = event.startedAtMs;
      mergeInto(existing, event);
    } else {
      byDevice.set(key, { ...event });
    }
  }

  const device: CombinedCallEvent[] = [];
  const app: CombinedCallEvent[] = [];
  for (const event of [...byDevice.values(), ...withoutDeviceId]) {
    if (isDeviceEvent(event)) device.push(event);
    else app.push(event);
  }

  const uniqueDevices = collapseSameMoment(device);
  const uniqueApps = collapseSameMoment(app);

  const devicesByPhone = new Map<string, CombinedCallEvent[]>();
  for (const event of uniqueDevices) {
    if (!event.phoneKey) continue;
    const key = `${event.userId}:${event.phoneKey}`;
    const list = devicesByPhone.get(key) ?? [];
    list.push(event);
    devicesByPhone.set(key, list);
  }

  const unmatched: CombinedCallEvent[] = [];
  for (const event of uniqueApps) {
    if (!event.phoneKey) {
      unmatched.push(event);
      continue;
    }
    const candidates = devicesByPhone.get(`${event.userId}:${event.phoneKey}`);
    if (!candidates || candidates.length === 0) {
      unmatched.push(event);
      continue;
    }

    let best: CombinedCallEvent | null = null;
    for (const candidate of candidates) {
      if (!appLogMatchesPhoneCall(event, candidate)) continue;
      if (!best || candidate.startedAtMs >= best.startedAtMs) best = candidate;
    }

    if (!best) {
      unmatched.push(event);
      continue;
    }
    mergeInto(best, event);
  }

  return [...uniqueDevices, ...unmatched];
}

export function emptyCombinedCallStats(): CombinedCallStats {
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

function finalizeStats(
  counts: Omit<
    CombinedCallStats,
    | "outgoingNotAnswered"
    | "incomingTotal"
    | "outgoingTotal"
    | "totalCalls"
    | "connected"
    | "totalTalkTimeSeconds"
    | "totalDurationSeconds"
    | "avgTalkTimeSeconds"
    | "minTalkTimeSeconds"
    | "maxTalkTimeSeconds"
  >,
  talkSamples: number[],
): CombinedCallStats {
  const incomingTotal = counts.incomingAnswered + counts.incomingMissed;
  const outgoingTotal = counts.outgoingAnswered + counts.outgoingNotConnected;
  const answeredCount = counts.incomingAnswered + counts.outgoingAnswered;
  const totalTalkTimeSeconds = talkSamples.reduce((sum, seconds) => sum + seconds, 0);
  return {
    ...counts,
    incomingTotal,
    outgoingTotal,
    outgoingNotAnswered: counts.outgoingNotConnected,
    totalCalls: incomingTotal + outgoingTotal,
    connected: answeredCount,
    totalTalkTimeSeconds,
    totalDurationSeconds: totalTalkTimeSeconds,
    avgTalkTimeSeconds: answeredCount > 0 ? Math.round(totalTalkTimeSeconds / answeredCount) : 0,
    minTalkTimeSeconds: talkSamples.length > 0 ? Math.min(...talkSamples) : 0,
    maxTalkTimeSeconds: talkSamples.length > 0 ? Math.max(...talkSamples) : 0,
  };
}

function addEvent(stats: CombinedCallStats, talkSamples: number[], event: CombinedCallEvent) {
  if (event.direction === "incoming") {
    if (event.kind === "answered") {
      stats.incomingAnswered += 1;
      stats.incomingDurationSeconds += event.durationSeconds;
      talkSamples.push(event.durationSeconds);
    } else {
      stats.incomingMissed += 1;
    }
    return;
  }

  if (event.kind === "answered") {
    stats.outgoingAnswered += 1;
    stats.outgoingDurationSeconds += event.durationSeconds;
    talkSamples.push(event.durationSeconds);
    return;
  }
  stats.outgoingNotConnected += 1;
}

export function aggregateCombinedCalls(events: CombinedCallEvent[]): {
  byUser: Map<string, CombinedCallStats>;
  totals: CombinedCallStats;
} {
  const unique = dedupeCombinedCalls(events);
  const drafts = new Map<string, { stats: CombinedCallStats; talk: number[] }>();
  const totalTalk: number[] = [];
  const totalDraft = emptyCombinedCallStats();

  for (const event of unique) {
    let draft = drafts.get(event.userId);
    if (!draft) {
      draft = { stats: emptyCombinedCallStats(), talk: [] };
      drafts.set(event.userId, draft);
    }
    addEvent(draft.stats, draft.talk, event);
    addEvent(totalDraft, totalTalk, event);
  }

  const byUser = new Map<string, CombinedCallStats>();
  for (const [userId, draft] of drafts) {
    byUser.set(userId, finalizeStats(draft.stats, draft.talk));
  }

  return { byUser, totals: finalizeStats(totalDraft, totalTalk) };
}

/** Footer row. Additive columns are the sum of the user rows. Avg = total talk / answered. */
export function sumCallCountTotals(rows: CallCountTotals[]): CallCountTotals {
  const totals: CallCountTotals = {
    incomingAnswered: 0,
    incomingMissed: 0,
    incomingTotal: 0,
    outgoingAnswered: 0,
    outgoingNotConnected: 0,
    outgoingTotal: 0,
    totalTalkTimeSeconds: 0,
    avgTalkTimeSeconds: 0,
    minTalkTimeSeconds: 0,
    maxTalkTimeSeconds: 0,
    totalCalls: 0,
  };
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  let sawAnswered = false;

  for (const row of rows) {
    totals.incomingAnswered += row.incomingAnswered;
    totals.incomingMissed += row.incomingMissed;
    totals.outgoingAnswered += row.outgoingAnswered;
    totals.outgoingNotConnected += row.outgoingNotConnected;
    totals.totalTalkTimeSeconds += row.totalTalkTimeSeconds;
    const answered = row.incomingAnswered + row.outgoingAnswered;
    if (answered > 0) {
      sawAnswered = true;
      min = Math.min(min, row.minTalkTimeSeconds);
      max = Math.max(max, row.maxTalkTimeSeconds);
    }
  }

  totals.incomingTotal = totals.incomingAnswered + totals.incomingMissed;
  totals.outgoingTotal = totals.outgoingAnswered + totals.outgoingNotConnected;
  totals.totalCalls = totals.incomingTotal + totals.outgoingTotal;
  const answered = totals.incomingAnswered + totals.outgoingAnswered;
  totals.avgTalkTimeSeconds = answered > 0 ? Math.round(totals.totalTalkTimeSeconds / answered) : 0;
  totals.minTalkTimeSeconds = sawAnswered ? min : 0;
  totals.maxTalkTimeSeconds = sawAnswered ? max : 0;
  return totals;
}
