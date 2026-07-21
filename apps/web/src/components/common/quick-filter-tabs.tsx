"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@propninja/ui/lib/utils";

export type QuickFilterTab<T extends string> = {
  id: T;
  label: string;
  chipClass?: string;
};

type QuickFilterTabsProps<T extends string> = {
  tabs: QuickFilterTab<T>[];
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
  isLoadingCounts?: boolean;
  variant?: "pill" | "chip";
  ariaLabel?: string;
  className?: string;
};

function CountBubble({
  count,
  active,
  variant,
}: {
  count: number;
  active: boolean;
  variant: "pill" | "chip";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none",
        variant === "pill"
          ? active
            ? "bg-white/25 text-white"
            : "bg-muted text-foreground"
          : active
            ? "bg-primary text-primary-foreground"
            : "bg-background/80 text-foreground",
      )}
    >
      {count.toLocaleString()}
    </span>
  );
}

export function QuickFilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  counts,
  isLoadingCounts,
  variant = "pill",
  ariaLabel = "Quick filters",
  className,
}: QuickFilterTabsProps<T>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-muted/40 p-2 dark:bg-muted/20", className)}
    >
      <div
        className={cn(
          "flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5",
          "snap-x snap-mandatory md:flex-wrap md:overflow-visible md:snap-none",
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const active = value === tab.id;
          const count = counts?.[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex shrink-0 snap-start items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                variant === "pill" &&
                  (active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-foreground hover:bg-accent"),
                variant === "chip" &&
                  cn(
                    "border text-xs sm:text-sm",
                    tab.chipClass,
                    active
                      ? "border-primary ring-2 ring-primary/30"
                      : "opacity-90 hover:opacity-100",
                  ),
              )}
            >
              <span className="whitespace-nowrap">{tab.label}</span>
              {isLoadingCounts ? (
                <Skeleton className="h-4 w-6 rounded-full" />
              ) : count !== undefined ? (
                <CountBubble count={count} active={active} variant={variant} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
