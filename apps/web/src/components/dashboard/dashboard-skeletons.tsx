import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@propninja/ui/card";

export function KpiStripSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10">
      {Array.from({ length: 10 }, (_, index) => (
        <Card
          key={`kpi-skeleton-${index}`}
          className="min-w-[9.5rem] shrink-0 border-border/60 shadow-sm"
        >
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SourcesPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, column) => (
        <div key={`source-col-${column}`} className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, row) => (
              <Skeleton key={`source-row-${column}-${row}`} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className={tall ? "h-72 w-full rounded-lg" : "h-56 w-full rounded-lg lg:h-64"} />
      </CardContent>
    </Card>
  );
}

export function CallsSectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>
  );
}

export function OverviewSectionsSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <KpiStripSkeleton />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <SourcesPanelSkeleton />
      </div>
      <ChartCardSkeleton tall />
      <CallsSectionSkeleton />
    </div>
  );
}
