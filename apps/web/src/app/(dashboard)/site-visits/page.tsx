"use client";

import { SiteVisitsCalendar } from "@/components/site-visits/site-visits-calendar";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function SiteVisitsPageContent() {
  const searchParams = useSearchParams();
  const initialDate = useMemo(() => {
    if (searchParams.get("date") === "today") return new Date();
    const raw = searchParams.get("date");
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`);
    return undefined;
  }, [searchParams]);

  return <SiteVisitsCalendar initialDate={initialDate} />;
}

export default function SiteVisitsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading site visits…</p>}>
      <SiteVisitsPageContent />
    </Suspense>
  );
}
