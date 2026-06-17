import {
  calculateCallDurationMinutes,
  callStartIso,
  shouldOpenCallLogSheet,
} from "@/lib/callDuration";
import {
  type PendingCallRecord,
  clearPendingCall,
  readPendingCall,
  savePendingCall,
} from "@/lib/pendingCallStorage";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export type CallSessionContext = {
  leadId: string;
  leadName: string;
  phoneNumber: string;
};

export type CallReturnInfo = {
  durationMinutes: number;
  calledAt: string;
};

type UseCallDurationTrackingOptions = {
  onReturn: (info: CallReturnInfo) => void;
  onPendingCall?: (pending: PendingCallRecord) => void;
};

/**
 * Tracks SIM dialer sessions via AppState. Pending call state is kept in memory only
 * (no AsyncStorage) so phone numbers and lead names are never written to disk.
 */
export function useCallDurationTracking({
  onReturn,
  onPendingCall,
}: UseCallDurationTrackingOptions) {
  const callStartTimeRef = useRef<number | null>(null);
  const sessionRef = useRef<CallSessionContext | null>(null);
  const wentToBackgroundRef = useRef(false);
  const handledReturnRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearCallSession = useCallback(() => {
    callStartTimeRef.current = null;
    sessionRef.current = null;
    wentToBackgroundRef.current = false;
    handledReturnRef.current = false;
    void clearPendingCall();
  }, []);

  const beginCall = useCallback((context: CallSessionContext) => {
    handledReturnRef.current = false;
    wentToBackgroundRef.current = false;
    callStartTimeRef.current = Date.now();
    sessionRef.current = context;
    void savePendingCall({
      leadId: context.leadId,
      callStartTime: callStartTimeRef.current,
    });
  }, []);

  const finishReturn = useCallback(
    (startMs: number) => {
      if (handledReturnRef.current) return;
      if (!shouldOpenCallLogSheet(startMs)) {
        clearCallSession();
        return;
      }

      handledReturnRef.current = true;
      const durationMinutes = calculateCallDurationMinutes(startMs);
      onReturn({
        durationMinutes,
        calledAt: callStartIso(startMs),
      });
      callStartTimeRef.current = null;
      wentToBackgroundRef.current = false;
    },
    [clearCallSession, onReturn],
  );

  useEffect(() => {
    void (async () => {
      const pending = await readPendingCall();
      if (!pending || !onPendingCall) return;

      const activeStart = callStartTimeRef.current;
      if (activeStart != null && Math.abs(activeStart - pending.callStartTime) < 1_000) {
        return;
      }

      onPendingCall(pending);
    })();
  }, [onPendingCall]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const startMs = callStartTimeRef.current;
      if (startMs == null) return;

      if (nextState === "background" || nextState === "inactive") {
        wentToBackgroundRef.current = true;
        return;
      }

      if (
        nextState === "active" &&
        wentToBackgroundRef.current &&
        (previousState === "background" || previousState === "inactive")
      ) {
        finishReturn(startMs);
      }
    });

    return () => subscription.remove();
  }, [finishReturn]);

  return { beginCall, clearCallSession };
}

/** @deprecated Use useCallDurationTracking — kept for existing imports during migration. */
export function useReturnFromDialerLog(
  onReturn: (info: CallReturnInfo) => void,
  options?: { onPendingCall?: (pending: PendingCallRecord) => void },
) {
  return useCallDurationTracking({ onReturn, onPendingCall: options?.onPendingCall });
}
