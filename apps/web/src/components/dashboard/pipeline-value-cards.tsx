"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
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
          <Card key={stage.status} className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize text-muted-foreground">
                {stage.status}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-bold">{stage.count}</p>
              <p className="text-xs text-muted-foreground">
                ₹{stage.total_value.toLocaleString("en-IN")} pipeline value
              </p>
              <p
                className={cn(
                  "flex items-center gap-0.5 text-xs font-semibold",
                  positive ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {positive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(stage.trend_percent)}% vs prior 30 days
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
