import { cn } from "@propninja/ui/lib/utils";
import { Flame, Snowflake, Sun } from "lucide-react";

export const STATUS_CHIP: Record<string, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  contacted: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  qualified: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  negotiation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export const TEMP_CHIP: Record<string, string> = {
  cold: "border border-border bg-transparent text-muted-foreground",
  warm: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  hot: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        STATUS_CHIP[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function TemperatureChip({ temperature }: { temperature: string | null | undefined }) {
  if (!temperature) return null;
  const Icon = temperature === "hot" ? Flame : temperature === "cold" ? Snowflake : Sun;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        TEMP_CHIP[temperature] ?? "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {temperature}
    </span>
  );
}

export function ProjectChip({ name }: { name: string }) {
  return (
    <span className="inline-flex rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
      {name}
    </span>
  );
}
