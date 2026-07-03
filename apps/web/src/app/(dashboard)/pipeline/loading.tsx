import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {Array.from({ length: 5 }, (_, col) => (
        <div key={`col-${col}`} className="flex w-72 shrink-0 flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 4 }, (_, card) => (
            <Skeleton key={`card-${col}-${card}`} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  );
}
