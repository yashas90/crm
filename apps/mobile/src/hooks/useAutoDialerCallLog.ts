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
  onLogged?: (outcome: CallOutcome, meta: AutoLoggedCall) => void;
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

/** Result of an automatic (non-editable) call count write. */
export type AutoLoggedCall = {
  leadId: string;
  phoneNumber: string;
  durationSeconds: number;
  durationIsTalkOnly: boolean;
  outcome: CallOutcome;
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

  // Prefer explicit talk override only when provided by automated pipeline (not agent UI).
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
 * Tracks native dialer sessions. When the agent returns from the dialer, the call is
 * **automatically recorded** from OS talk time (or wall-clock fallback). Agents cannot
 * edit outcome or duration — those drive Call Report counts.
 *
 * After auto-log, screens may open a lead-status sheet (notes / stage only).
 */
export function useAutoDialerCallLog({
  logCall,
  onLogged,
  onLogError,
}: UseAutoDialerCallLogOptions) {
  const sessionRef = useRef<CallSessionContext | null>(null);
  const [autoLoggedCall, setAutoLoggedCall] = useState<AutoLoggedCall | null>(null);
  const loggingRef = useRef(false);
  /** Prevents double-counting the same dial. */
  const callCountedRef = useRef(false);
  const nativeReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoggedRef = useRef(onLogged);
  const onLogErrorRef = useRef(onLogError);
  const logCallRef = useRef(logCall);
  onLoggedRef.current = onLogged;
  onLogErrorRef.current = onLogError;
  logCallRef.current = logCall;

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
        const meta: AutoLoggedCall = {
          leadId: pending.leadId,
          phoneNumber: pending.phoneNumber,
          durationSeconds: talkSeconds,
          durationIsTalkOnly: pending.durationIsTalkOnly,
          outcome,
        };
        setAutoLoggedCall(meta);
        onLoggedRef.current?.(outcome, meta);
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

  const handleReturn = useCallback(
    (info: CallReturnInfo) => {
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
      // Wait 2 s for the OS to flush, then auto-record without agent edits.
      nativeReadTimerRef.current = setTimeout(() => {
        nativeReadTimerRef.current = null;
        void getOutgoingCallTalkSeconds(context.phoneNumber, callStartMs - 5_000).then(
          (nativeSecs) => {
            const durationSeconds = nativeSecs != null ? nativeSecs : fallbackSeconds;
            const durationIsTalkOnly = nativeSecs != null;
            const pending: PostCallPrompt = {
              durationSeconds,
              durationIsTalkOnly,
              phoneNumber: context.phoneNumber,
              leadId: context.leadId,
              calledAt,
            };
            const outcome = defaultOutcomeFromDuration(durationSeconds);
            void submitCallLog(pending, outcome).catch(() => undefined);
          },
        );
      }, 2_000);
    },
    [submitCallLog],
  );

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
      setAutoLoggedCall(null);
      trackCall(context);
    },
    [trackCall],
  );

  const clearAutoLoggedCall = useCallback(() => {
    setAutoLoggedCall(null);
    clearCallSession();
  }, [clearCallSession]);

  /** @deprecated Prefer clearAutoLoggedCall — kept for screen compatibility. */
  const dismissPostCall = useCallback(() => {
    clearAutoLoggedCall();
  }, [clearAutoLoggedCall]);

  /**
   * @deprecated Manual confirm removed — calls auto-log on dialer return.
   * Kept so older screens/tests compile; no-ops if already counted.
   */
  const confirmLog = useCallback(
    async (outcome: CallOutcome, notes?: string, ringSeconds?: number, talkSeconds?: number) => {
      // No pending prompt in auto mode — already logged or nothing to do.
      if (callCountedRef.current) return;
      void outcome;
      void notes;
      void ringSeconds;
      void talkSeconds;
    },
    [],
  );

  return {
    beginCall,
    /** Set after a successful automatic call count write. */
    autoLoggedCall,
    clearAutoLoggedCall,
    dismissPostCall,
    submitCallLog,
    isLogging: loggingRef.current,
    // Legacy aliases — post-call metric modal removed; always null / false.
    postCallPrompt: null as PostCallPrompt | null,
    isPostCallPrompt: false,
    pendingLog: null as PostCallPrompt | null,
    isPendingLog: false,
    dismissPending: dismissPostCall,
    confirmLog,
    review: null,
    dismissReview: dismissPostCall,
    isReviewOpen: false,
  };
}
