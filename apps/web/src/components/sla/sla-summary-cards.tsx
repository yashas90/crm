"use client";

import { StatCard } from "@/components/reports/stat-card";
import { SLA_THRESHOLD_DAYS, SLA_THRESHOLD_LABELS, type SlaSummary } from "@/lib/sla";
import { cn } from "@propninja/ui/lib/utils";

type SlaSummaryCardsProps = {
  summary?: SlaSummary;
  isLoading?: boolean;
  selectedDays?: number;
  onSelectDays?: (days: number) => void;
};

export function SlaSummaryCards({
  summary,
  isLoading,
  selectedDays,
  onSelectDays,
}: SlaSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {SLA_THRESHOLD_DAYS.map((days) => {
        const count = summary?.[`inactive_${days}d` as keyof SlaSummary] ?? 0;
        const active = selectedDays === days;
        const Wrapper = onSelectDays ? "button" : "div";

        return (
          <Wrapper
            key={days}
            type={onSelectDays ? "button" : undefined}
            onClick={onSelectDays ? () => onSelectDays(days) : undefined}
            className={cn(
              "text-left transition-all",
              onSelectDays &&
                "cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && onSelectDays && "ring-2 ring-[#204060] ring-offset-2 dark:ring-indigo-400",
            )}
          >
            <StatCard
              title={SLA_THRESHOLD_LABELS[days] ?? `${days}d inactive`}
              value={isLoading ? "—" : Number(count)}
              hint={days === 3 ? "Default SLA threshold" : undefined}
            />
          </Wrapper>
        );
      })}
    </div>
  );
}

export function SlaFlaggedBanner({
  flagged,
  isLoading,
}: { flagged?: number; isLoading?: boolean }) {
  if (isLoading || !flagged) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      <span className="font-semibold tabular-nums">{flagged}</span> lead
      {flagged === 1 ? "" : "s"} flagged with an SLA breach timestamp in the database.
    </div>
  );
}
