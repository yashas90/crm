/**
 * One calling report for lead calls (`call_records`) and data calls
 * (`contact_call_logs`), plus phone-log rows (`agent_call_logs`) that are
 * the same event or an incoming call the apps did not log.
 *
 * The same phone event is one row. Lead and data logs win on classification.
 * A matched phone log fills talk time when the app stored zero seconds.
 */

export const COMBINED_CALL_MATCH_WINDOW_MS = 2 * 60 * 1000;

const DATA_CONVERSATION_OUTCOMES = new Set(["interested", "not_interested", "callback"]);

export type CombinedCallDirection = "incoming" | "outgoing";
export type CombinedCallKind = "answered" | "missed" | "not_connected";

export type CombinedCallEvent = {
  userId: string;
  phoneKey: string | null;
  startedAtMs: number;
  direction: CombinedCallDirection;
  kind: CombinedCallKind;
  durationSeconds: number;
  /** 0 lead, 1 data, 2 device. Lower rank is the canonical app log. */
  sourceRank: number;
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

export function callPhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function clampDuration(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function classifyLeadCall(input: LeadCallForStats): CombinedCallEvent {
  const duration = clampDuration(input.durationSeconds);
  const direction: CombinedCallDirection = input.direction === "incoming" ? "incoming" : "outgoing";
  const labeledAnswered = input.outcome === "answered" || input.disposition === "answered";
  const explicitMiss = input.status === "missed" || input.status === "rejected";
  const answered = labeledAnswered && duration > 0 && !explicitMiss;
  const kind: CombinedCallKind =
    direction === "incoming"
      ? answered
        ? "answered"
        : "missed"
      : answered
        ? "answered"
        : "not_connected";

  return {
    userId: input.userId,
    phoneKey: callPhoneKey(input.phone),
    startedAtMs: input.startedAt.getTime(),
    direction,
    kind,
    durationSeconds: answered ? duration : 0,
    sourceRank: 0,
  };
}

export function classifyDataCall(input: DataCallForStats): CombinedCallEvent {
  const duration = clampDuration(input.durationSeconds);
  const conversation = DATA_CONVERSATION_OUTCOMES.has(input.outcome);
  const answered = duration > 0 || conversation;

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

export function classifyDeviceCall(input: DeviceCallForStats): CombinedCallEvent {
  const type = input.callType.trim().toUpperCase();
  const duration = clampDuration(input.durationSeconds);
  let direction: CombinedCallDirection = "outgoing";
  let kind: CombinedCallKind = "not_connected";
  let storedDuration = 0;

  if (type === "MISSED" || type === "REJECTED") {
    direction = "incoming";
    kind = "missed";
  } else if (type === "INCOMING") {
    direction = "incoming";
    if (duration > 0) {
      kind = "answered";
      storedDuration = duration;
    } else {
      kind = "missed";
    }
  } else if (duration > 0) {
    kind = "answered";
    storedDuration = duration;
  }

  return {
    userId: input.userId,
    phoneKey: callPhoneKey(input.phone),
    startedAtMs: input.startedAt.getTime(),
    direction,
    kind,
    durationSeconds: storedDuration,
    sourceRank: 2,
  };
}

function mergeInto(target: CombinedCallEvent, extra: CombinedCallEvent) {
  const duration = Math.max(target.durationSeconds, extra.durationSeconds);
  const answered = target.kind === "answered" || extra.kind === "answered" || duration > 0;
  target.sourceRank = Math.min(target.sourceRank, extra.sourceRank);
  if (answered) {
    target.kind = "answered";
    target.durationSeconds = duration;
    return;
  }
  if (target.direction === "incoming") {
    target.kind = "missed";
    target.durationSeconds = 0;
    return;
  }
  target.kind = "not_connected";
  target.durationSeconds = 0;
}

/** Collapse logs of one phone event. Different numbers and directions stay separate. */
export function dedupeCombinedCalls(events: CombinedCallEvent[]): CombinedCallEvent[] {
  const keyed: CombinedCallEvent[] = [];
  const unkeyed: CombinedCallEvent[] = [];

  for (const event of events) {
    if (event.phoneKey) keyed.push(event);
    else unkeyed.push({ ...event });
  }

  keyed.sort((a, b) => {
    if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
    if (a.phoneKey !== b.phoneKey) return (a.phoneKey ?? "") < (b.phoneKey ?? "") ? -1 : 1;
    if (a.direction !== b.direction) return a.direction < b.direction ? -1 : 1;
    return a.startedAtMs - b.startedAtMs;
  });

  const kept: CombinedCallEvent[] = [];
  for (const event of keyed) {
    const previous = kept[kept.length - 1];
    if (
      previous &&
      previous.userId === event.userId &&
      previous.phoneKey === event.phoneKey &&
      previous.direction === event.direction &&
      event.startedAtMs - previous.startedAtMs <= COMBINED_CALL_MATCH_WINDOW_MS
    ) {
      mergeInto(previous, event);
      continue;
    }
    kept.push({ ...event });
  }

  return [...kept, ...unkeyed];
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
  const positive = talkSamples.filter((seconds) => seconds > 0);
  const totalTalkTimeSeconds = positive.reduce((sum, seconds) => sum + seconds, 0);
  return {
    ...counts,
    outgoingNotAnswered: counts.outgoingNotConnected,
    totalCalls: counts.incomingTotal + counts.outgoingTotal,
    connected: counts.incomingAnswered + counts.outgoingAnswered,
    totalTalkTimeSeconds,
    totalDurationSeconds: totalTalkTimeSeconds,
    avgTalkTimeSeconds:
      positive.length > 0 ? Math.round(totalTalkTimeSeconds / positive.length) : 0,
    minTalkTimeSeconds: positive.length > 0 ? Math.min(...positive) : 0,
    maxTalkTimeSeconds: positive.length > 0 ? Math.max(...positive) : 0,
  };
}

function addEvent(stats: CombinedCallStats, talkSamples: number[], event: CombinedCallEvent) {
  if (event.direction === "incoming") {
    stats.incomingTotal += 1;
    if (event.kind === "answered") {
      stats.incomingAnswered += 1;
      stats.incomingDurationSeconds += event.durationSeconds;
      if (event.durationSeconds > 0) talkSamples.push(event.durationSeconds);
    } else {
      stats.incomingMissed += 1;
    }
    return;
  }

  stats.outgoingTotal += 1;
  if (event.kind === "answered") {
    stats.outgoingAnswered += 1;
    stats.outgoingDurationSeconds += event.durationSeconds;
    if (event.durationSeconds > 0) talkSamples.push(event.durationSeconds);
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
