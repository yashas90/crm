import type { LogCallInput } from "@/hooks/use-calls";
import {
  type CallReturnInfo,
  type CallSessionContext,
  useCallDurationTracking,
} from "@/hooks/useCallDurationTracking";
import { useCallback, useRef, useState } from "react";

type UseAutoDialerCallLogOptions = {
  logCall: (payload: LogCallInput) => Promise<unknown>;
  onLogged?: () => void;
  onLogError?: (error: unknown) => void;
};

export type DialerReviewState = {
  durationSeconds: number;
  phoneNumber: string;
};

function elapsedSeconds(info: CallReturnInfo): number {
  const endedAt = Date.now();
  const startedAt = new Date(info.calledAt).getTime();
  const fromClock = Math.round((endedAt - startedAt) / 1000);
  const fromMinutes = info.durationMinutes > 0 ? info.durationMinutes * 60 : 0;
  return Math.max(1, fromClock || fromMinutes || 60);
}

/**
 * Tracks native dialer sessions (AppState) and auto-logs calls when the agent returns.
 * Opens a review sheet so agents can confirm without re-submitting (avoids duplicates).
 */
export function useAutoDialerCallLog({
  logCall,
  onLogged,
  onLogError,
}: UseAutoDialerCallLogOptions) {
  const sessionRef = useRef<CallSessionContext | null>(null);
  const [review, setReview] = useState<DialerReviewState | null>(null);
  const loggingRef = useRef(false);

  const handleReturn = useCallback(
    async (info: CallReturnInfo) => {
      const context = sessionRef.current;
      if (!context || loggingRef.current) return;

      const durationSeconds = elapsedSeconds(info);
      const endedAt = new Date();
      const startedAt = new Date(info.calledAt);

      loggingRef.current = true;
      try {
        await logCall({
          lead_id: context.leadId,
          phone_number: context.phoneNumber,
          direction: "outgoing",
          duration_seconds: durationSeconds,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          outcome: "answered",
          source: "mobile-auto",
        });
        onLogged?.();
        setReview({ durationSeconds, phoneNumber: context.phoneNumber });
      } catch (error) {
        onLogError?.(error);
      } finally {
        loggingRef.current = false;
        sessionRef.current = null;
      }
    },
    [logCall, onLogged, onLogError],
  );

  const { beginCall: trackCall, clearCallSession } = useCallDurationTracking({
    onReturn: (info) => void handleReturn(info),
  });

  const beginCall = useCallback(
    (context: CallSessionContext) => {
      sessionRef.current = context;
      setReview(null);
      trackCall(context);
    },
    [trackCall],
  );

  const dismissReview = useCallback(() => {
    setReview(null);
    clearCallSession();
  }, [clearCallSession]);

  return {
    beginCall,
    review,
    dismissReview,
    isReviewOpen: review !== null,
  };
}
