"use client";

import { useStaleQueryBanner } from "@/hooks/use-stale-query-banner";

export function StaleDataBanner() {
  const visible = useStaleQueryBanner();
  if (!visible) return null;

  return (
    <output className="block w-full border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      Couldn&apos;t refresh some data. Showing your last loaded results.
    </output>
  );
}
