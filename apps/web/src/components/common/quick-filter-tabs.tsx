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
  /** pill = primary scope row; chip = colored stage chips */
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
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-background text-muted-foreground shadow-[2px_2px_0_0_#000]"
          : active
            ? "bg-background/80 text-foreground"
            : "bg-background/60 text-muted-foreground",
      )}
    >
      {count}
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
    <div className={cn("border-2 border-black bg-muted/10 p-1.5", className)}>
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin",
          "snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5",
          "md:flex-wrap md:overflow-visible md:snap-none",
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
                "inline-flex shrink-0 snap-start items-center gap-2 rounded-full border-2 px-3 py-2 text-sm font-bold transition-all",
                variant === "pill" &&
                  (active
                    ? "border-black bg-[#204060] text-white shadow-[2px_2px_0_0_#000]"
                    : "border-transparent text-neutral-600 hover:border-black hover:bg-white hover:shadow-[2px_2px_0_0_#000]"),
                variant === "chip" &&
                  cn(
                    tab.chipClass,
                    "border-2 border-black text-xs font-bold",
                    active && "shadow-[2px_2px_0_0_#000]",
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
