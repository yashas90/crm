import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";
import { Platform } from "react-native";

/**
 * Minimum time away before auto-opening the call log modal.
 * iOS returns from Phone slightly faster; Android may need a beat longer.
 */
const MIN_AUTO_LOG_MS = Platform.OS === "ios" ? 2_000 : 3_000;
const MAX_AUTO_LOG_MS = 5 * 60 * 1000;

/**
 * Tracks when the user left for the native dialer and fires `onReturn` when the
 * screen regains focus after a plausible call (works on iOS + Android).
 */
export function useReturnFromDialerLog(onReturn: () => void) {
  const callStartTsRef = useRef<number | undefined>(undefined);
  const autoOpenedRef = useRef(false);

  const beginCall = useCallback(() => {
    autoOpenedRef.current = false;
    callStartTsRef.current = Date.now();
  }, []);

  const resetCallTracking = useCallback(() => {
    callStartTsRef.current = undefined;
    autoOpenedRef.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const started = callStartTsRef.current;
      if (!started || autoOpenedRef.current) return;

      const elapsed = Date.now() - started;
      if (elapsed >= MIN_AUTO_LOG_MS && elapsed <= MAX_AUTO_LOG_MS) {
        autoOpenedRef.current = true;
        callStartTsRef.current = undefined;
        onReturn();
      }
    }, [onReturn]),
  );

  return { beginCall, resetCallTracking };
}
