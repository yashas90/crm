"use client";

import { LEADS_SOURCE_FILTER_CHIPS } from "@/lib/lead-sources";
import { cn } from "@propninja/ui/lib/utils";

type LeadsSourceChipsProps = {
  value: string;
  adLeadsOnly: boolean;
  onChange: (source: string) => void;
  onAdLeadsOnlyChange: (adLeadsOnly: boolean) => void;
  className?: string;
};

export function LeadsSourceChips({
  value,
  adLeadsOnly,
  onChange,
  onAdLeadsOnlyChange,
  className,
}: LeadsSourceChipsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Lead source
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
        aria-label="Filter by lead source"
      >
        {LEADS_SOURCE_FILTER_CHIPS.map((chip) => {
          const active = !adLeadsOnly && value === chip.value;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange(chip.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              {chip.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onAdLeadsOnlyChange(!adLeadsOnly)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            adLeadsOnly
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          Ad Leads
        </button>
      </div>
    </div>
  );
}
