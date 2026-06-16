"use client";

import { useUsers } from "@/hooks/use-users";
import type { ReportFilterValue } from "@/lib/report-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";

const PRESETS: { id: ReportFilterValue["dateRange"]["preset"]; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "custom", label: "Custom" },
];

type ReportFilterBarProps = {
  value: ReportFilterValue;
  onChange: (next: ReportFilterValue) => void;
  hideAgent?: boolean;
};

export function ReportFilterBar({ value, onChange, hideAgent = false }: ReportFilterBarProps) {
  const { data: users } = useUsers();
  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent
        className={hideAgent ? "grid gap-4 md:grid-cols-2" : "grid gap-4 md:grid-cols-3"}
      >
        <div className="space-y-2">
          <Label htmlFor="datePreset">Date range</Label>
          <select
            id="datePreset"
            className={selectClass}
            value={value.dateRange.preset}
            onChange={(e) =>
              onChange({
                ...value,
                dateRange: {
                  preset: e.target.value as ReportFilterValue["dateRange"]["preset"],
                  from: value.dateRange.from,
                  to: value.dateRange.to,
                },
              })
            }
          >
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {!hideAgent ? (
          <div className="space-y-2">
            <Label htmlFor="agent">Agent</Label>
            <select
              id="agent"
              className={selectClass}
              value={value.userId ?? ""}
              onChange={(e) => onChange({ ...value, userId: e.target.value || undefined })}
            >
              <option value="">All agents</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {value.dateRange.preset === "custom" ? (
          <div className="grid gap-4 md:col-span-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
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
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
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
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
