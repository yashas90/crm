"use client";

import { formatScoreFactor, scoreBadgeClass, scoreTierLabel } from "@/lib/lead-score-display";
import { scoreTier } from "@/lib/lead-scoring-constants";
import { cn } from "@propninja/ui/lib/utils";

type LeadScoreBadgeProps = {
  score: number;
  className?: string;
  showPoints?: boolean;
};

export function LeadScoreBadge({ score, className, showPoints = false }: LeadScoreBadgeProps) {
  const tier = scoreTier(score);
  const label = scoreTierLabel(tier);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        scoreBadgeClass(tier),
        className,
      )}
    >
      {label}
      {showPoints ? ` · ${score}` : null}
    </span>
  );
}

type LeadScoreBreakdownTooltipProps = {
  factors: { label: string; points: number }[];
  score: number;
  children: React.ReactNode;
};

export function LeadScoreBreakdownTooltip({
  factors,
  score,
  children,
}: LeadScoreBreakdownTooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden min-w-[220px] rounded-lg border border-border bg-popover p-3 text-xs shadow-[4px_4px_0_0_#000] group-hover:block"
      >
        <p className="mb-2 font-semibold">Score: {score}</p>
        {factors.length > 0 ? (
          <ul className="space-y-1 text-muted-foreground">
            {factors.map((factor) => (
              <li key={`${factor.label}-${factor.points}`}>
                {formatScoreFactor(factor.points)} {factor.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No scoring signals yet.</p>
        )}
      </span>
    </span>
  );
}
