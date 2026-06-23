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

export type PendingAutoLog = {
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
 * Tracks native dialer sessions (AppState). When the agent returns from the dialer,
 * sets a pending log state — the actual API call is deferred until confirmLog() so
 * the agent can set the correct outcome (or it auto-submits as "answered" after a
 * short countdown in the UI). This prevents every call being logged as "answered".
 */
export function useAutoDialerCallLog({
  logCall,
  onLogged,
  onLogError,
}: UseAutoDialerCallLogOptions) {
  const sessionRef = useRef<CallSessionContext | null>(null);
  const [pendingLog, setPendingLog] = useState<PendingAutoLog | null>(null);
  const loggingRef = useRef(false);

  const handleReturn = useCallback((info: CallReturnInfo) => {
    const context = sessionRef.current;
    if (!context) return;

    const durationSeconds = elapsedSeconds(info);
    setPendingLog({
      durationSeconds,
      phoneNumber: context.phoneNumber,
      leadId: context.leadId,
      calledAt: info.calledAt,
    });
    sessionRef.current = null;
  }, []);

  const { beginCall: trackCall, clearCallSession } = useCallDurationTracking({
    onReturn: handleReturn,
  });

  const beginCall = useCallback(
    (context: CallSessionContext) => {
      sessionRef.current = context;
      setPendingLog(null);
      trackCall(context);
    },
    [trackCall],
  );

  /** Called by the UI when the agent confirms (or auto-timer fires). */
  const confirmLog = useCallback(
    async (outcome: CallOutcome, notes?: string) => {
      const pending = pendingLog;
      if (!pending || loggingRef.current) return;

      loggingRef.current = true;
      try {
        const endedAt = new Date();
        const startedAt = new Date(pending.calledAt);
        await logCall({
          lead_id: pending.leadId,
          phone_number: pending.phoneNumber,
          direction: "outgoing",
          duration_seconds: pending.durationSeconds,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          outcome,
          notes,
          source: "mobile-auto",
        });
        setPendingLog(null);
        onLogged?.(outcome);
      } catch (error) {
        onLogError?.(error);
      } finally {
        loggingRef.current = false;
      }
    },
    [pendingLog, logCall, onLogged, onLogError],
  );

  const dismissPending = useCallback(() => {
    setPendingLog(null);
    clearCallSession();
  }, [clearCallSession]);

  return {
    beginCall,
    pendingLog,
    isPendingLog: pendingLog !== null,
    confirmLog,
    dismissPending,
    isLogging: loggingRef.current,
    // Legacy aliases kept for any existing callers
    review: pendingLog
      ? { durationSeconds: pendingLog.durationSeconds, phoneNumber: pendingLog.phoneNumber }
      : null,
    dismissReview: dismissPending,
    isReviewOpen: pendingLog !== null,
  };
}
