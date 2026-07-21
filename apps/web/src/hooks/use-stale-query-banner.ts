"use client";

import { getQueryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

function hasStaleActiveQuery(): boolean {
  return getQueryClient()
    .getQueryCache()
    .getAll()
    .some((query) => {
      if (query.getObserversCount() <= 0) return false;
      return query.state.status === "error" && query.state.data !== undefined;
    });
}

/** True when any mounted query failed a refresh but still has cached data. */
export function useStaleQueryBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cache = getQueryClient().getQueryCache();
    setVisible(hasStaleActiveQuery());
    return cache.subscribe(() => {
      setVisible(hasStaleActiveQuery());
    });
  }, []);

  return visible;
}
