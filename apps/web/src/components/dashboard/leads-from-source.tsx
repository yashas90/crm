"use client";

import type { SourceCount, SourceGroupReport } from "@/hooks/use-reports";
import { drillDownRoutes } from "@/lib/drill-down-routes";
import { AD_LEAD_SOURCE_LABELS } from "@/lib/lead-sources";
import { cn } from "@propninja/ui/lib/utils";
import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, memo } from "react";

const GROUP_LABELS: Record<SourceGroupReport["sourceGroup"], string> = {
  Social: "Social Profiles",
  Portals: "Portals",
  Others: "Others",
};

const AD_SOURCE_NAMES = new Set<string>(AD_LEAD_SOURCE_LABELS);

const BAR_PALETTE = [
  "bg-sky-50 border-sky-200/80 text-sky-900 dark:bg-sky-950/30 dark:border-sky-800/60 dark:text-sky-100",
  "bg-violet-50 border-violet-200/80 text-violet-900 dark:bg-violet-950/30 dark:border-violet-800/60 dark:text-violet-100",
  "bg-emerald-50 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-100",
  "bg-amber-50 border-amber-200/80 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-100",
  "bg-rose-50 border-rose-200/80 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/60 dark:text-rose-100",
  "bg-teal-50 border-teal-200/80 text-teal-900 dark:bg-teal-950/30 dark:border-teal-800/60 dark:text-teal-100",
];

const ICON_PALETTE = [
  "bg-sky-200/80 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  "bg-violet-200/80 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  "bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  "bg-amber-200/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  "bg-rose-200/80 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  "bg-teal-200/80 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200",
];

function sourceInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function adLeadsTotal(sources: SourceCount[]) {
  return sources
    .filter((source) => AD_SOURCE_NAMES.has(source.name))
    .reduce((sum, source) => sum + source.count, 0);
}

type SourceBarProps = {
  name: string;
  count: number;
  barClass: string;
  iconClass: string;
  icon?: ReactNode;
  onClick: () => void;
};

function SourceBar({ name, count, barClass, iconClass, icon, onClick }: SourceBarProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-opacity hover:opacity-90",
          barClass,
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold",
            iconClass,
          )}
          aria-hidden
        >
          {icon ?? sourceInitials(name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{count}</span>
      </button>
    </li>
  );
}

type LeadsFromSourceProps = {
  groups: SourceGroupReport[];
};

export const LeadsFromSource = memo(function LeadsFromSource({ groups }: LeadsFromSourceProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const showAdLeadsAggregate = group.sourceGroup === "Social";
        const totalAdLeads = showAdLeadsAggregate ? adLeadsTotal(group.sources) : 0;

        return (
          <div key={group.sourceGroup} className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              {GROUP_LABELS[group.sourceGroup]}
            </h4>

            {group.sources.length === 0 && !showAdLeadsAggregate ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <ul className="space-y-2">
                {showAdLeadsAggregate ? (
                  <SourceBar
                    name="All Ad Leads"
                    count={totalAdLeads}
                    barClass="bg-emerald-50 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-100"
                    iconClass="bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                    icon={<Megaphone className="h-4 w-4" />}
                    onClick={() => router.push(drillDownRoutes.adLeads())}
                  />
                ) : null}

                {group.sources.map((source, index) => {
                  const isAdSource = AD_SOURCE_NAMES.has(source.name);
                  const paletteIndex = showAdLeadsAggregate ? index + 1 : index;
                  const barClass = isAdSource
                    ? "bg-blue-50 border-blue-200/80 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800/60 dark:text-blue-100"
                    : BAR_PALETTE[paletteIndex % BAR_PALETTE.length]!;
                  const iconClass = isAdSource
                    ? "bg-blue-200/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
                    : ICON_PALETTE[paletteIndex % ICON_PALETTE.length]!;

                  return (
                    <SourceBar
                      key={source.name}
                      name={source.name}
                      count={source.count}
                      barClass={barClass}
                      iconClass={iconClass}
                      onClick={() => router.push(drillDownRoutes.leadsBySource(source.name))}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
});
