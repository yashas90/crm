import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

/** Refetch live data when the screen gains focus, but not more than once per 15s. */
export function useRefreshOnFocus(refetch: () => Promise<unknown> | undefined) {
  const lastRefetchAt = useRef(0);

  const runRefetch = useCallback(() => {
    const now = Date.now();
    if (now - lastRefetchAt.current < 15_000) return;
    lastRefetchAt.current = now;
    void refetch();
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      runRefetch();
    }, [runRefetch]),
  );
}
