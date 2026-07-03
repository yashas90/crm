import { ChartCardSkeleton, KpiStripSkeleton } from "@/components/dashboard/dashboard-skeletons";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 p-6">
      <KpiStripSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCardSkeleton tall />
        </div>
        <ChartCardSkeleton tall />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
