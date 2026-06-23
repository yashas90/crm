"use client";

import { ANALYTICS_DATE_PRESETS, type AnalyticsFilterValue } from "@/lib/analytics-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type AnalyticsDateFilterProps = {
  value: AnalyticsFilterValue;
  onChange: (next: AnalyticsFilterValue) => void;
};

export function AnalyticsDateFilter({ value, onChange }: AnalyticsDateFilterProps) {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle className="text-base">Date range</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="analyticsPreset">Period</Label>
          <select
            id="analyticsPreset"
            className={selectClass}
            value={value.dateRange.preset}
            onChange={(e) =>
              onChange({
                ...value,
                dateRange: {
                  preset: e.target.value as AnalyticsFilterValue["dateRange"]["preset"],
                  from: value.dateRange.from,
                  to: value.dateRange.to,
                },
              })
            }
          >
            {ANALYTICS_DATE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {value.dateRange.preset === "custom" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="analyticsFrom">From</Label>
              <Input
                id="analyticsFrom"
                type="date"
                value={value.dateRange.from ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    dateRange: { ...value.dateRange, from: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analyticsTo">To</Label>
              <Input
                id="analyticsTo"
                type="date"
                value={value.dateRange.to ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    dateRange: { ...value.dateRange, to: e.target.value },
                  })
                }
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
