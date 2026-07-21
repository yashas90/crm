import { queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

function hasStaleActiveQuery(): boolean {
  return queryClient
    .getQueryCache()
    .getAll()
    .some((query) => {
      const observers = query.getObserversCount();
      if (observers <= 0) return false;
      return query.state.status === "error" && query.state.data !== undefined;
    });
}

/** True when any mounted query failed a refresh but still has cached data. */
export function useStaleQueryBanner() {
  const [visible, setVisible] = useState(hasStaleActiveQuery);

  useEffect(() => {
    return queryClient.getQueryCache().subscribe(() => {
      setVisible(hasStaleActiveQuery());
    });
  }, []);

  return visible;
}
