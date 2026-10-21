/**
 * One definition of answered / missed / not connected for every call surface.
 *
 * Answered means the other party picked up and there is real conversation time.
 * Ring time, dial time, and 1–2s carrier or voicemail artifacts are not talk time.
 */

export const DEFAULT_MIN_TALK_SECONDS = 3;

/**
 * Same agent + phone + start within this window is one logged row.
 * Used for a double submit of the same log, not for matching the app log to the phone log.
 */
export const CALL_DEDUPE_WINDOW_MS = 2_000;

/**
 * One dial recorded by the app and by the phone.
 * The app stamps dial-tap or talk-start. The phone stamps when the call was placed.
 * Ring time and the delay until the agent returns to the app sit between those clocks.
 */
export const CALL_CROSS_SOURCE_WINDOW_MS = 2 * 60 * 1000;

/** Outcomes and statuses that mean the customer did not have a conversation. */
export const EXPLICIT_NON_ANSWER_TOKENS = [
  "no_answer",
  "busy",
  "rejected",
  "failed",
  "missed",
  "left_voicemail",
  "invalid",
  "dnc",
] as const;

const NON_ANSWER = new Set<string>(EXPLICIT_NON_ANSWER_TOKENS);
const DATA_CONVERSATION = new Set(["interested", "not_interested", "callback"]);

export type CallMetricKind = "answered" | "missed" | "not_connected";
export type CallMetricDirection = "incoming" | "outgoing";

export type ClassifiedCall = {
  direction: CallMetricDirection;
  kind: CallMetricKind;
  /** Conversation seconds. 0 unless the call is answered. */
  talkSeconds: number;
  answered: boolean;
};

export type ClassifyCallInput = {
  direction?: string | null;
  durationSeconds?: number | null;
  outcome?: string | null;
  disposition?: string | null;
  status?: string | null;
  /** OS call type: INCOMING, OUTGOING, MISSED, REJECTED, UNKNOWN. */
  callType?: string | null;
};

function readMinTalkSeconds(): number {
  const raw =
    typeof process !== "undefined" && process.env ? process.env.MIN_TALK_SECONDS : undefined;
  if (raw == null || raw === "") return DEFAULT_MIN_TALK_SECONDS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MIN_TALK_SECONDS;
  return Math.floor(parsed);
}

/** Override with the MIN_TALK_SECONDS env var. Default is 3. */
export const MIN_TALK_SECONDS = readMinTalkSeconds();

export function clampTalkSeconds(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function hasMeasurableTalk(
  durationSeconds: number,
  minTalkSeconds = MIN_TALK_SECONDS,
): boolean {
  return durationSeconds >= minTalkSeconds;
}

function token(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Classify one call.
 * Talk time is the connected duration, and only when the call is answered.
 */
export function classifyCall(
  input: ClassifyCallInput,
  minTalkSeconds = MIN_TALK_SECONDS,
): ClassifiedCall {
  const duration = clampTalkSeconds(input.durationSeconds);
  const callType = (input.callType ?? "").trim().toUpperCase();
  const outcome = token(input.outcome);
  const disposition = token(input.disposition);
  const status = token(input.status);

  const direction: CallMetricDirection =
    input.direction === "incoming" ||
    callType === "INCOMING" ||
    callType === "MISSED" ||
    callType === "REJECTED" ||
    callType === "BLOCKED" ||
    callType === "VOICEMAIL"
      ? "incoming"
      : "outgoing";

  const explicitMiss =
    NON_ANSWER.has(status) ||
    NON_ANSWER.has(outcome) ||
    NON_ANSWER.has(disposition) ||
    callType === "MISSED" ||
    callType === "REJECTED" ||
    callType === "BLOCKED" ||
    callType === "VOICEMAIL";

  const labeledAnswered = outcome === "answered" || disposition === "answered";
  const deviceConnected =
    callType === "INCOMING" || callType === "OUTGOING" || callType === "UNKNOWN";
  const dataConversation = DATA_CONVERSATION.has(outcome);
  const connectedSignal =
    labeledAnswered || dataConversation || deviceConnected || status === "completed";

  const answered = !explicitMiss && hasMeasurableTalk(duration, minTalkSeconds) && connectedSignal;

  const kind: CallMetricKind = answered
    ? "answered"
    : direction === "incoming"
      ? "missed"
      : "not_connected";

  return {
    direction,
    kind,
    talkSeconds: answered ? duration : 0,
    answered,
  };
}

export function callMetricStatusLabel(kind: CallMetricKind): string {
  switch (kind) {
    case "answered":
      return "Answered";
    case "missed":
      return "Missed";
    case "not_connected":
      return "Not connected";
  }
}
