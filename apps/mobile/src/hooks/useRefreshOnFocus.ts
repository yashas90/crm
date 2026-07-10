import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

type RefreshOnFocusOptions = {
  /** Minimum ms between refetches. Use 0 for task lists that must refresh after every visit. */
  minIntervalMs?: number;
};

/** Refetch live data when the screen gains focus (default: at most once per 15s). */
export function useRefreshOnFocus(
  refetch: () => Promise<unknown> | undefined,
  options?: RefreshOnFocusOptions,
) {
  const lastRefetchAt = useRef(0);
  const minIntervalMs = options?.minIntervalMs ?? 15_000;

  const runRefetch = useCallback(() => {
    const now = Date.now();
    if (now - lastRefetchAt.current < minIntervalMs) return;
    lastRefetchAt.current = now;
    void refetch();
  }, [minIntervalMs, refetch]);

  useFocusEffect(
    useCallback(() => {
      runRefetch();
    }, [runRefetch]),
  );
}
