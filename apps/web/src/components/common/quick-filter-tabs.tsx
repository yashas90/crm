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
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
        variant === "pill"
          ? active
            ? "bg-white/20 text-white"
            : "bg-slate-100 text-slate-600"
          : active
            ? "bg-white text-slate-900"
            : "bg-slate-100 text-slate-500",
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
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/80 p-1.5", className)}>
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5",
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
                "inline-flex shrink-0 snap-start items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                variant === "pill" &&
                  (active
                    ? "bg-[#204060] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"),
                variant === "chip" &&
                  cn(
                    tab.chipClass,
                    "border text-xs",
                    active
                      ? "border-[#204060] bg-[#204060]/10 text-[#204060]"
                      : "border-slate-200 bg-white text-slate-600",
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
