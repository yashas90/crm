import { OverviewSectionsSkeleton } from "@/components/dashboard/dashboard-skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      <OverviewSectionsSkeleton />
    </div>
  );
}
