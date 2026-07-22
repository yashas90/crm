import type { LogCallInput } from "@/hooks/use-calls";
import {
  type CallReturnInfo,
  type CallSessionContext,
  useCallDurationTracking,
} from "@/hooks/useCallDurationTracking";
import { getOutgoingCallTalkSeconds } from "@/lib/callLogNative";
import type { CallOutcome } from "@propninja/types/enums";
import { useCallback, useRef, useState } from "react";

type UseAutoDialerCallLogOptions = {
  logCall: (payload: LogCallInput) => Promise<unknown>;
  onLogged?: (outcome: CallOutcome) => void;
  onLogError?: (error: unknown) => void;
};

export type PostCallPrompt = {
  /**
   * Measured seconds: native CallLog talk time when available, otherwise dial→return
   * wall-clock elapsed (includes ringing).
   */
  durationSeconds: number;
  /** True when durationSeconds is Android CallLog talk-only (answer → hangup). */
  durationIsTalkOnly: boolean;
  phoneNumber: string;
  leadId: string;
  calledAt: string;
};

function elapsedSeconds(info: CallReturnInfo): number {
  const endedAt = Date.now();
  const startedAt = new Date(info.calledAt).getTime();
  const fromClock = Math.round((endedAt - startedAt) / 1000);
  const fromMinutes = info.durationMinutes > 0 ? info.durationMinutes * 60 : 0;
  return Math.max(1, fromClock || fromMinutes || 60);
}

export function resolveTalkSeconds(params: {
  pending: Pick<PostCallPrompt, "durationSeconds" | "durationIsTalkOnly">;
  outcome: CallOutcome;
  ringSeconds?: number;
  talkOverride?: number;
}): number {
  const { pending, outcome, ringSeconds, talkOverride } = params;
  if (outcome !== "answered") return 0;

  // Modal talk field is authoritative when provided (already adjusted for ring in UI).
  if (talkOverride != null && Number.isFinite(talkOverride) && talkOverride >= 0) {
    return Math.round(talkOverride);
  }

  if (pending.durationIsTalkOnly) {
    return Math.max(0, Math.round(pending.durationSeconds));
  }

  // Wall-clock fallback includes ring — subtract ring to get connected talk time.
  return Math.max(0, Math.round(pending.durationSeconds) - (ringSeconds ?? 0));
}

/**
 * Tracks native dialer sessions. When the agent returns from the dialer a post-call
 * prompt is shown so they can confirm outcome, ring time, and talk duration before
 * the call is logged to the API.
 *
 * Talk time = connected (phone timer 00:00) → hangup. Dial/ring time is excluded.
 */
export function useAutoDialerCallLog({
  logCall,
  onLogged,
  onLogError,
}: UseAutoDialerCallLogOptions) {
  const sessionRef = useRef<CallSessionContext | null>(null);
  const [postCallPrompt, setPostCallPrompt] = useState<PostCallPrompt | null>(null);
  const postCallPromptRef = useRef<PostCallPrompt | null>(null);
  const loggingRef = useRef(false);

  postCallPromptRef.current = postCallPrompt;

  const submitCallLog = useCallback(
    async (
      pending: PostCallPrompt,
      outcome: CallOutcome = "answered",
      notes?: string,
      ringSeconds?: number,
      talkOverride?: number,
    ) => {
      if (loggingRef.current) return;
      loggingRef.current = true;
      try {
        const talkSeconds = resolveTalkSeconds({
          pending,
          outcome,
          ringSeconds,
          talkOverride,
        });
        const endedAt = new Date();
        // Persist the connected window (talk start → hangup), not dial-tap → app return.
        const startedAt = new Date(endedAt.getTime() - talkSeconds * 1000);
        await logCall({
          lead_id: pending.leadId,
          phone_number: pending.phoneNumber,
          direction: "outgoing",
          status: "completed",
          duration_seconds: talkSeconds,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          outcome,
          notes,
          ring_seconds: ringSeconds,
          source: "mobile-auto",
        });
        onLogged?.(outcome);
      } catch (error) {
        onLogError?.(error);
        throw error;
      } finally {
        loggingRef.current = false;
      }
    },
    [logCall, onLogged, onLogError],
  );

  const handleReturn = useCallback((info: CallReturnInfo) => {
    const context = sessionRef.current;
    if (!context) return;
    sessionRef.current = null;

    const calledAt = info.calledAt;
    const fallbackSeconds = elapsedSeconds(info);
    const callStartMs = new Date(calledAt).getTime();

    // Android writes the call to the system call log after the call ends.
    // DURATION in CallLog.Calls is talk time only — ring time is excluded by the OS.
    // We wait 2 s for the OS to flush the record, then try to read accurate talktime.
    setTimeout(() => {
      void getOutgoingCallTalkSeconds(context.phoneNumber, callStartMs - 5_000).then(
        (nativeSecs) => {
          setPostCallPrompt({
            durationSeconds: nativeSecs != null ? nativeSecs : fallbackSeconds,
            durationIsTalkOnly: nativeSecs != null,
            phoneNumber: context.phoneNumber,
            leadId: context.leadId,
            calledAt,
          });
        },
      );
    }, 2_000);
  }, []);

  const { beginCall: trackCall, clearCallSession } = useCallDurationTracking({
    onReturn: handleReturn,
  });

  const beginCall = useCallback(
    (context: CallSessionContext) => {
      sessionRef.current = context;
      setPostCallPrompt(null);
      trackCall(context);
    },
    [trackCall],
  );

  const dismissPostCall = useCallback(() => {
    setPostCallPrompt(null);
    clearCallSession();
  }, [clearCallSession]);

  const confirmLog = useCallback(
    async (
      outcome: CallOutcome,
      notes?: string,
      ringSeconds?: number,
      talkSeconds?: number,
    ) => {
      const pending = postCallPromptRef.current;
      if (!pending) return;
      await submitCallLog(pending, outcome, notes, ringSeconds, talkSeconds);
      setPostCallPrompt(null);
      clearCallSession();
    },
    [clearCallSession, submitCallLog],
  );

  return {
    beginCall,
    postCallPrompt,
    isPostCallPrompt: postCallPrompt !== null,
    dismissPostCall,
    submitCallLog,
    isLogging: loggingRef.current,
    // Legacy aliases used by screens/tests
    pendingLog: postCallPrompt,
    isPendingLog: postCallPrompt !== null,
    dismissPending: dismissPostCall,
    confirmLog,
    review: postCallPrompt
      ? { durationSeconds: postCallPrompt.durationSeconds, phoneNumber: postCallPrompt.phoneNumber }
      : null,
    dismissReview: dismissPostCall,
    isReviewOpen: postCallPrompt !== null,
  };
}
