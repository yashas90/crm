"use client";

import { cn } from "@propninja/ui/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type PipelineStage = {
  status: string;
  count: number;
  total_value: number;
  trend_percent: number;
};

export function PipelineValueCards({ pipeline }: { pipeline: PipelineStage[] }) {
  if (pipeline.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {pipeline.map((stage) => {
        const positive = stage.trend_percent >= 0;
        return (
          <div
            key={stage.status}
            className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
          >
            <p className="font-heading text-xs font-bold uppercase tracking-wide text-neutral-600">
              {stage.status}
            </p>
            <p className="mt-2 font-heading text-4xl font-bold tracking-tighter">{stage.count}</p>
            <p className="mt-1 text-xs font-medium text-neutral-600">
              ₹{stage.total_value.toLocaleString("en-IN")} pipeline value
            </p>
            <p
              className={cn(
                "mt-2 flex items-center gap-0.5 text-xs font-bold uppercase",
                positive ? "text-green-700" : "text-[#C02020]",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(stage.trend_percent)}% vs prior 30 days
            </p>
          </div>
        );
      })}
    </div>
  );
}
