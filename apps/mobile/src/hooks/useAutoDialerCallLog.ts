import type { LogCallInput } from "@/hooks/use-calls";
import {
  type CallReturnInfo,
  type CallSessionContext,
  useCallDurationTracking,
} from "@/hooks/useCallDurationTracking";
import { waitForOutgoingCallTalkSeconds } from "@/lib/callLogNative";
import { classifyNativeTalk, outcomeFromTalkSeconds } from "@/lib/callOutcomeFromTalk";
import type { CallOutcome } from "@propninja/types/enums";
import { useCallback, useEffect, useRef, useState } from "react";

type UseAutoDialerCallLogOptions = {
  logCall: (payload: LogCallInput) => Promise<unknown>;
  onLogged?: (outcome: CallOutcome, meta: AutoLoggedCall) => void;
  onLogError?: (error: unknown) => void;
};

export type PostCallPrompt = {
  /** Connected talk seconds from Android CallLog (0 when not answered / unavailable). */
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

export { outcomeFromTalkSeconds as defaultOutcomeFromDuration };

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
 * **automatically recorded** from OS talk time. Ring/wall-clock is never counted as answered.
 * Agents cannot edit outcome or duration — those drive Call Report counts.
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
  const nativeReadGenerationRef = useRef(0);
  const onLoggedRef = useRef(onLogged);
  const onLogErrorRef = useRef(onLogError);
  const logCallRef = useRef(logCall);
  onLoggedRef.current = onLogged;
  onLogErrorRef.current = onLogError;
  logCallRef.current = logCall;

  useEffect(() => {
    return () => {
      nativeReadGenerationRef.current += 1;
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
        const resolvedOutcome = outcome === "answered" && talkSeconds <= 0 ? "no_answer" : outcome;
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
          outcome: resolvedOutcome,
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
          outcome: resolvedOutcome,
        };
        setAutoLoggedCall(meta);
        onLoggedRef.current?.(resolvedOutcome, meta);
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
      const callStartMs = new Date(calledAt).getTime();
      const generation = ++nativeReadGenerationRef.current;

      // Android writes the call-log row after hangup. DURATION is talk time only —
      // ring time is never proof the customer picked up. Retry until the OS flushes.
      void waitForOutgoingCallTalkSeconds(context.phoneNumber, callStartMs - 5_000).then(
        (nativeSecs) => {
          if (generation !== nativeReadGenerationRef.current) return;
          const classified = classifyNativeTalk(nativeSecs);
          const pending: PostCallPrompt = {
            durationSeconds: classified.durationSeconds,
            durationIsTalkOnly: classified.durationIsTalkOnly,
            phoneNumber: context.phoneNumber,
            leadId: context.leadId,
            calledAt,
          };
          void submitCallLog(pending, classified.outcome).catch(() => undefined);
        },
      );
    },
    [submitCallLog],
  );

  const { beginCall: trackCall, clearCallSession } = useCallDurationTracking({
    onReturn: handleReturn,
  });

  const beginCall = useCallback(
    (context: CallSessionContext) => {
      nativeReadGenerationRef.current += 1;
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
