import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={`filter-${i}`} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={`row-${i}`} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
