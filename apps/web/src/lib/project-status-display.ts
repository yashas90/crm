const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  },
  pre_launch: {
    label: "Pre Launch",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  launch: {
    label: "Launch",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  ongoing: {
    label: "Ongoing",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  },
  completed: {
    label: "Completed",
    className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

export function getProjectStatusDisplay(status: string) {
  const normalized = status.toLowerCase();
  return (
    STATUS_STYLES[normalized] ?? {
      label: status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      className: "bg-muted text-muted-foreground",
    }
  );
}

export function formatProjectCategory(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
