import { deferUntilIdle } from "@/lib/deferUntilIdle";
import { useEffect, useState } from "react";

/** Becomes true after first interactions settle — use to gate non-critical queries. */
export function useDeferredStartupReady(fallbackMs = 600): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return deferUntilIdle(() => setReady(true), fallbackMs);
  }, [fallbackMs]);

  return ready;
}
