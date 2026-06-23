"use client";

import { LEADS_SOURCE_FILTER_CHIPS } from "@/lib/lead-sources";
import { cn } from "@propninja/ui/lib/utils";

type LeadsSourceChipsProps = {
  value: string;
  adLeadsOnly: boolean;
  onChange: (source: string) => void;
  className?: string;
};

export function LeadsSourceChips({
  value,
  adLeadsOnly,
  onChange,
  className,
}: LeadsSourceChipsProps) {
  const activeValue = adLeadsOnly ? "" : value;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead source</p>
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
        aria-label="Filter by lead source"
      >
        {LEADS_SOURCE_FILTER_CHIPS.map((chip) => {
          const active = activeValue === chip.value;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange(chip.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-[#204060] bg-[#204060] text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
