import type { LogCallInput } from "@/hooks/use-calls";
import {
  type CallReturnInfo,
  type CallSessionContext,
  useCallDurationTracking,
} from "@/hooks/useCallDurationTracking";
import type { CallOutcome } from "@propninja/types/enums";
import { useCallback, useRef, useState } from "react";

type UseAutoDialerCallLogOptions = {
  logCall: (payload: LogCallInput) => Promise<unknown>;
  onLogged?: (outcome: CallOutcome) => void;
  onLogError?: (error: unknown) => void;
};

export type PostCallPrompt = {
  /** Total elapsed seconds from dial tap to app return (raw measurement). */
  durationSeconds: number;
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

/**
 * Tracks native dialer sessions. When the agent returns from the dialer a post-call
 * prompt is shown so they can confirm outcome, ring time, and talk duration before
 * the call is logged to the API.
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
    ) => {
      if (loggingRef.current) return;
      loggingRef.current = true;
      try {
        const talkSeconds = Math.max(0, pending.durationSeconds - (ringSeconds ?? 0));
        const endedAt = new Date();
        const startedAt = new Date(pending.calledAt);
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

    const pending: PostCallPrompt = {
      durationSeconds: elapsedSeconds(info),
      phoneNumber: context.phoneNumber,
      leadId: context.leadId,
      calledAt: info.calledAt,
    };
    sessionRef.current = null;
    setPostCallPrompt(pending);
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
    async (outcome: CallOutcome, notes?: string, ringSeconds?: number) => {
      const pending = postCallPromptRef.current;
      if (!pending) return;
      await submitCallLog(pending, outcome, notes, ringSeconds);
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
