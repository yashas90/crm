"use client";

import { LeadsAdSourceTabs } from "@/components/leads/leads-ad-source-tabs";
import { LeadsFilterBar } from "@/components/leads/leads-filter-bar";
import { LeadsQuickFilterTabs } from "@/components/leads/leads-quick-filter-tabs";
import { LeadsStageBar } from "@/components/leads/leads-stage-bar";
import type { LeadsDatePreset } from "@/lib/leads-date-filters";
import type { LeadScopeCounts, LeadsScope } from "@/lib/leads-scope";
import type { LeadStageCounts, LeadsStage } from "@/lib/leads-stage";
import type { LeadsColumnVisibility } from "@/lib/leads-table-columns";
import type { LeadsUrlFilters } from "@/lib/leads-url-filters";

type LeadsListFiltersProps = {
  scope: LeadsScope;
  onScopeChange: (scope: LeadsScope) => void;
  scopeCounts?: LeadScopeCounts;
  scopeCountsLoading?: boolean;
  stage: LeadsStage;
  onStageChange: (stage: LeadsStage) => void;
  stageCounts?: LeadStageCounts;
  stageCountsLoading?: boolean;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: () => void;
  filters: LeadsUrlFilters;
  onDatePresetChange: (preset: LeadsDatePreset, range?: { from?: string; to?: string }) => void;
  columns: LeadsColumnVisibility;
  onColumnsChange: (columns: LeadsColumnVisibility) => void;
  onOpenAdvancedFilters: () => void;
  advancedFilterCount: number;
  onAdLeadsOnlyChange: (value: boolean) => void;
};

/**
 * Leads list filter stack:
 * 1) Quick scope tabs (who/what subset)
 * 2) Stage tabs (pipeline slice within scope)
 * 3) Search + date + columns + advanced filters
 */
export function LeadsListFilters({
  scope,
  onScopeChange,
  scopeCounts,
  scopeCountsLoading,
  stage,
  onStageChange,
  stageCounts,
  stageCountsLoading,
  searchDraft,
  onSearchDraftChange,
  onSearchSubmit,
  filters,
  onDatePresetChange,
  columns,
  onColumnsChange,
  onOpenAdvancedFilters,
  advancedFilterCount,
  onAdLeadsOnlyChange,
}: LeadsListFiltersProps) {
  return (
    <section className="space-y-3" aria-label="Lead filters">
      <LeadsQuickFilterTabs
        value={scope}
        onChange={onScopeChange}
        counts={scopeCounts}
        isLoadingCounts={scopeCountsLoading}
      />
      <LeadsStageBar
        value={stage}
        onChange={onStageChange}
        counts={stageCounts}
        isLoadingCounts={stageCountsLoading}
      />
      <LeadsAdSourceTabs
        adLeadsOnly={filters.adLeadsOnly}
        onChange={(value) => {
          onAdLeadsOnlyChange(value);
        }}
      />
      <LeadsFilterBar
        searchDraft={searchDraft}
        onSearchDraftChange={onSearchDraftChange}
        onSearchSubmit={onSearchSubmit}
        datePreset={filters.datePreset}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDatePresetChange={onDatePresetChange}
        columns={columns}
        onColumnsChange={onColumnsChange}
        onOpenFilters={onOpenAdvancedFilters}
        activeFilterCount={advancedFilterCount}
      />
    </section>
  );
}
