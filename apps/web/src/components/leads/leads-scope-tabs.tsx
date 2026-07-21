"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { LEADS_PRIMARY_SCOPES, LEADS_SECONDARY_SCOPES } from "@/lib/lead-sources";
import type { LeadScopeCounts, LeadsScope } from "@/lib/leads-scope";
import { cn } from "@propninja/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

type LeadsScopeTabsProps = {
  value: LeadsScope;
  onChange: (scope: LeadsScope) => void;
  counts?: LeadScopeCounts;
  isLoadingCounts?: boolean;
  isAdmin?: boolean;
  className?: string;
};

function ScopeCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
        active ? "bg-white/25 text-white" : "bg-muted text-foreground",
      )}
    >
      {count}
    </span>
  );
}

export function LeadsScopeTabs({
  value,
  onChange,
  counts,
  isLoadingCounts,
  isAdmin = false,
  className,
}: LeadsScopeTabsProps) {
  const isPrimary = LEADS_PRIMARY_SCOPES.some((tab) => tab.id === value);
  // When a secondary bucket is selected, do not fake-highlight "All Leads".
  const primaryValue = isPrimary ? value : null;

  // Sliding pill indicator
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    if (!primaryValue) {
      setIndicator({ left: 0, width: 0, ready: false });
      return;
    }
    const activeIndex = LEADS_PRIMARY_SCOPES.findIndex((t) => t.id === primaryValue);
    const tab = tabRefs.current[activeIndex];
    if (tab) {
      setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth, ready: true });
    }
  }, [primaryValue]);

  const visibleSecondary = LEADS_SECONDARY_SCOPES.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Primary pill strip with sliding indicator */}
      <div
        className="relative inline-flex rounded-xl border border-border bg-muted/40 p-1 shadow-sm"
        role="tablist"
        aria-label="Lead ownership scope"
      >
        {/* Sliding background pill */}
        {indicator.ready && (
          <div
            className="absolute top-1 rounded-lg bg-primary shadow-md transition-all duration-200 ease-out"
            style={{
              left: indicator.left,
              width: indicator.width,
              height: "calc(100% - 8px)",
            }}
          />
        )}

        {LEADS_PRIMARY_SCOPES.map((tab, i) => {
          const active = primaryValue === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative z-10 inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-150",
                active ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground",
              )}
            >
              {tab.label}
              {isLoadingCounts ? (
                <Skeleton className="ml-2 h-4 w-6 rounded-full" />
              ) : count !== undefined ? (
                <ScopeCount count={count} active={active} />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Secondary chip strip */}
      <div className="flex flex-wrap gap-2" aria-label="Additional lead scopes">
        {visibleSecondary.map((tab) => {
          const active = value === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(active ? "all" : tab.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              {tab.label}
              {isLoadingCounts ? (
                <Skeleton className="ml-1.5 h-3.5 w-5 rounded-full" />
              ) : count !== undefined ? (
                <span
                  className={cn(
                    "ml-1.5 tabular-nums",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
