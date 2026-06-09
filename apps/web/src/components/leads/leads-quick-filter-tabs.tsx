"use client";

import { QuickFilterTabs } from "@/components/common/quick-filter-tabs";
import { LEADS_QUICK_FILTER_TABS, type LeadScopeCounts, type LeadsScope } from "@/lib/leads-scope";

type LeadsQuickFilterTabsProps = {
  value: LeadsScope;
  onChange: (scope: LeadsScope) => void;
  counts?: LeadScopeCounts;
  isLoadingCounts?: boolean;
  className?: string;
};

/** Scope quick filters for the leads list (All / My Leads / Team's / …). */
export function LeadsQuickFilterTabs({
  value,
  onChange,
  counts,
  isLoadingCounts,
  className,
}: LeadsQuickFilterTabsProps) {
  return (
    <QuickFilterTabs
      tabs={LEADS_QUICK_FILTER_TABS}
      value={value}
      onChange={onChange}
      counts={counts}
      isLoadingCounts={isLoadingCounts}
      variant="pill"
      ariaLabel="Lead scope"
      className={className}
    />
  );
}
