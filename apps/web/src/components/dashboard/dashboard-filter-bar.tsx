"use client";

import { useUsers } from "@/hooks/use-users";
import {
  DASHBOARD_DATE_PRESETS,
  DASHBOARD_STATUS_OPTIONS,
  type DashboardFilterValue,
} from "@/lib/dashboard-filters";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";

const selectClass =
  "h-10 min-w-[9rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]/20 dark:border-white/10 dark:bg-white/5";

type DashboardFilterBarProps = {
  value: DashboardFilterValue;
  onChange: (next: DashboardFilterValue) => void;
  className?: string;
};

export function DashboardFilterBar({ value, onChange, className }: DashboardFilterBarProps) {
  const { data: users } = useUsers();

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5",
        className,
      )}
    >
      <div className="space-y-1">
        <Label htmlFor="dashboard-date-preset" className="text-xs text-neutral-600">
          Date range
        </Label>
        <select
          id="dashboard-date-preset"
          className={selectClass}
          value={value.dateRange.preset}
          onChange={(event) =>
            onChange({
              ...value,
              dateRange: {
                preset: event.target.value as DashboardFilterValue["dateRange"]["preset"],
                from: value.dateRange.from,
                to: value.dateRange.to,
              },
            })
          }
        >
          {DASHBOARD_DATE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {value.dateRange.preset === "custom" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="dashboard-from" className="text-xs text-neutral-600">
              From
            </Label>
            <Input
              id="dashboard-from"
              type="date"
              className="h-9 w-[10.5rem]"
              value={value.dateRange.from ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  dateRange: { ...value.dateRange, from: event.target.value },
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dashboard-to" className="text-xs text-neutral-600">
              To
            </Label>
            <Input
              id="dashboard-to"
              type="date"
              className="h-9 w-[10.5rem]"
              value={value.dateRange.to ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  dateRange: { ...value.dateRange, to: event.target.value },
                })
              }
            />
          </div>
        </>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="dashboard-user" className="text-xs text-neutral-600">
          User
        </Label>
        <select
          id="dashboard-user"
          className={selectClass}
          value={value.userId ?? ""}
          onChange={(event) => onChange({ ...value, userId: event.target.value || undefined })}
        >
          <option value="">All users</option>
          {users?.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="dashboard-status" className="text-xs text-neutral-600">
          Stage
        </Label>
        <select
          id="dashboard-status"
          className={selectClass}
          value={value.status ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              status: event.target.value as DashboardFilterValue["status"],
            })
          }
        >
          {DASHBOARD_STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
