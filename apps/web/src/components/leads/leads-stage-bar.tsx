"use client";

import { QuickFilterTabs } from "@/components/common/quick-filter-tabs";
import { LEAD_STAGES, type LeadStageCounts, type LeadsStage } from "@/lib/leads-stage";

type LeadsStageBarProps = {
  value: LeadsStage;
  onChange: (stage: LeadsStage) => void;
  counts?: LeadStageCounts;
  isLoadingCounts?: boolean;
  className?: string;
};

/** Stage chips — refine within the current scope quick filter. */
export function LeadsStageBar({
  value,
  onChange,
  counts,
  isLoadingCounts,
  className,
}: LeadsStageBarProps) {
  return (
    <QuickFilterTabs
      tabs={LEAD_STAGES}
      value={value}
      onChange={onChange}
      counts={counts}
      isLoadingCounts={isLoadingCounts}
      variant="chip"
      ariaLabel="Lead stage"
      className={className}
    />
  );
}
