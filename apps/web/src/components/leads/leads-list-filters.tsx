"use client";

import { LeadsAdSourceTabs } from "@/components/leads/leads-ad-source-tabs";
import { LeadsFilterBar } from "@/components/leads/leads-filter-bar";
import { LeadsSourceChips } from "@/components/leads/leads-source-chips";
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
  onSourceChange: (source: string) => void;
  isAdmin?: boolean;
};

export function LeadsListFilters({
  scope: _scope,
  onScopeChange: _onScopeChange,
  scopeCounts: _scopeCounts,
  scopeCountsLoading: _scopeCountsLoading,
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
  onSourceChange,
  isAdmin = false,
}: LeadsListFiltersProps) {
  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Lead filters"
    >
      <LeadsSourceChips
        value={filters.source}
        adLeadsOnly={filters.adLeadsOnly}
        onChange={onSourceChange}
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
