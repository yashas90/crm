"use client";

import { AdminDashboardView } from "@/components/dashboard/admin-dashboard-view";
import { OverviewSectionsSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { MorningBrief } from "@/components/dashboard/morning-brief";
import { NeuButton } from "@/components/ui/neubrutal";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { Suspense, useState } from "react";

export default function DashboardPage() {
  const { session, ready } = useSession();
  const role = ready ? (session?.role ?? null) : null;
  const [showBrief, setShowBrief] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  if (!ready || !role) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (role === "agent") {
    return <MorningBrief />;
  }

  if (role === "manager") {
    return (
      <div className="space-y-8">
        <MorningBrief />
        <NeuButton type="button" onClick={() => setShowOverview((open) => !open)}>
          {showOverview ? "Hide team overview" : "Team overview"}
        </NeuButton>
        {showOverview ? (
          <Suspense fallback={<OverviewSectionsSkeleton />}>
            <AdminDashboardView enabled />
          </Suspense>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <NeuButton type="button" onClick={() => setShowBrief((open) => !open)}>
        {showBrief ? "Hide my morning brief" : "My morning brief"}
      </NeuButton>
      {showBrief ? <MorningBrief /> : null}
      <Suspense fallback={<OverviewSectionsSkeleton />}>
        <AdminDashboardView enabled />
      </Suspense>
    </div>
  );
}
