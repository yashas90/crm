"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { LEADS_PRIMARY_SCOPES, LEADS_SECONDARY_SCOPES } from "@/lib/lead-sources";
import type { LeadScopeCounts, LeadsScope } from "@/lib/leads-scope";
import { cn } from "@propninja/ui/lib/utils";

type LeadsScopeTabsProps = {
  value: LeadsScope;
  onChange: (scope: LeadsScope) => void;
  counts?: LeadScopeCounts;
  isLoadingCounts?: boolean;
  className?: string;
};

function ScopeCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
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
  className,
}: LeadsScopeTabsProps) {
  const isPrimary = LEADS_PRIMARY_SCOPES.some((tab) => tab.id === value);
  const primaryValue = isPrimary ? value : "all";

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Lead ownership scope"
      >
        {LEADS_PRIMARY_SCOPES.map((tab) => {
          const active = primaryValue === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-[#204060] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
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

      <div className="flex flex-wrap gap-2" aria-label="Additional lead scopes">
        {LEADS_SECONDARY_SCOPES.map((tab) => {
          const active = value === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "border-[#204060] bg-[#204060]/10 text-[#204060]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {tab.label}
              {isLoadingCounts ? (
                <Skeleton className="ml-1.5 h-3.5 w-5 rounded-full" />
              ) : count !== undefined ? (
                <span className="ml-1.5 tabular-nums text-slate-500">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
