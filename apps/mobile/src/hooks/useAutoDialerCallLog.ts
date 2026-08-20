import type { LogCallInput } from "@/hooks/use-calls";
import {
  type CallReturnInfo,
  type CallSessionContext,
  useCallDurationTracking,
} from "@/hooks/useCallDurationTracking";
import { getOutgoingCallTalkSeconds } from "@/lib/callLogNative";
import type { CallOutcome } from "@propninja/types/enums";
import { useCallback, useEffect, useRef, useState } from "react";

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

function defaultOutcomeFromDuration(seconds: number): CallOutcome {
  return seconds > 0 ? "answered" : "no_answer";
}

export { defaultOutcomeFromDuration };

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
 * prompt is shown so they can confirm outcome, ring time, and talk duration.
 * Dismissing without confirm still logs the call (default outcome) so counts stay accurate
 * even when the agent skips the lead status update.
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
  /** Prevents dismiss-after-confirm from logging the same dial twice. */
  const callCountedRef = useRef(false);
  const nativeReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoggedRef = useRef(onLogged);
  const onLogErrorRef = useRef(onLogError);
  const logCallRef = useRef(logCall);
  onLoggedRef.current = onLogged;
  onLogErrorRef.current = onLogError;
  logCallRef.current = logCall;

  postCallPromptRef.current = postCallPrompt;

  useEffect(() => {
    return () => {
      if (nativeReadTimerRef.current) {
        clearTimeout(nativeReadTimerRef.current);
        nativeReadTimerRef.current = null;
      }
    };
  }, []);

  const submitCallLog = useCallback(
    async (
      pending: PostCallPrompt,
      outcome: CallOutcome = "answered",
      notes?: string,
      ringSeconds?: number,
      talkOverride?: number,
    ): Promise<boolean> => {
      if (loggingRef.current || callCountedRef.current) return false;
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
        await logCallRef.current({
          lead_id: pending.leadId,
          phone_number: pending.phoneNumber,
          direction: "outgoing",
          duration_seconds: talkSeconds,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          outcome,
          notes,
          ring_seconds: ringSeconds,
          source: "mobile-auto",
        });
        callCountedRef.current = true;
        onLoggedRef.current?.(outcome);
        return true;
      } catch (error) {
        onLogErrorRef.current?.(error);
        throw error;
      } finally {
        loggingRef.current = false;
      }
    },
    [],
  );

  const handleReturn = useCallback((info: CallReturnInfo) => {
    const context = sessionRef.current;
    if (!context) return;
    sessionRef.current = null;

    const calledAt = info.calledAt;
    const fallbackSeconds = elapsedSeconds(info);
    const callStartMs = new Date(calledAt).getTime();

    if (nativeReadTimerRef.current) {
      clearTimeout(nativeReadTimerRef.current);
      nativeReadTimerRef.current = null;
    }

    // Android writes the call to the system call log after the call ends.
    // DURATION in CallLog.Calls is talk time only — ring time is excluded by the OS.
    // We wait 2 s for the OS to flush the record, then try to read accurate talktime.
    nativeReadTimerRef.current = setTimeout(() => {
      nativeReadTimerRef.current = null;
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
      if (nativeReadTimerRef.current) {
        clearTimeout(nativeReadTimerRef.current);
        nativeReadTimerRef.current = null;
      }
      sessionRef.current = context;
      callCountedRef.current = false;
      postCallPromptRef.current = null;
      setPostCallPrompt(null);
      trackCall(context);
    },
    [trackCall],
  );

  const dismissPostCall = useCallback(() => {
    const pending = postCallPromptRef.current;
    postCallPromptRef.current = null;
    setPostCallPrompt(null);
    clearCallSession();
    // Closing without confirming still counts the call (default outcome from duration).
    // Lead status update remains optional — call_records drive counts either way.
    if (pending && !callCountedRef.current) {
      void submitCallLog(pending, defaultOutcomeFromDuration(pending.durationSeconds)).catch(
        () => undefined,
      );
    }
  }, [clearCallSession, submitCallLog]);

  const confirmLog = useCallback(
    async (outcome: CallOutcome, notes?: string, ringSeconds?: number, talkSeconds?: number) => {
      const pending = postCallPromptRef.current;
      if (!pending) return;
      const logged = await submitCallLog(pending, outcome, notes, ringSeconds, talkSeconds);
      // Only clear the prompt after a successful log — early-return no-ops keep it open.
      if (!logged) return;
      postCallPromptRef.current = null;
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
