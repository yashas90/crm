import { Suspense } from "react";
import { LeadsPageView } from "./leads-page-view";

function LeadsPageFallback() {
  return <div className="p-8 text-sm text-muted-foreground">Loading leads…</div>;
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsPageFallback />}>
      <LeadsPageView />
    </Suspense>
  );
}
