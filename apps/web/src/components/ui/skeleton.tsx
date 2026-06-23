import { cn } from "@propninja/ui/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-neutral-200/60 dark:bg-white/10", className)} />
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
