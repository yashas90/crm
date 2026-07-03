import { ChartCardSkeleton, KpiStripSkeleton } from "@/components/dashboard/dashboard-skeletons";

export default function ReportsLoading() {
  return (
    <div className="space-y-6 p-6">
      <KpiStripSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCardSkeleton tall />
        <ChartCardSkeleton tall />
      </div>
    </div>
  );
}
