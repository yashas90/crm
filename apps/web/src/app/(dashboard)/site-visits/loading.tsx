import { Skeleton } from "@/components/ui/skeleton";

export default function SiteVisitsLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={`visit-${i}`} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
