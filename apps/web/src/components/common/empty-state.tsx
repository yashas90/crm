"use client";

import { Button } from "@propninja/ui/button";
import { Card, CardContent } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onActionClick,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed bg-neutral-50", className)}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 shadow-sm dark:border-white/10 dark:bg-white/10">
          {icon ?? <Inbox className="h-7 w-7" />}
        </div>
        <h3 className="font-heading text-lg font-bold uppercase">{title}</h3>
        {description ? (
          <p className="mt-2 max-w-sm text-sm font-medium text-neutral-600">{description}</p>
        ) : null}
        {actionLabel && onActionClick ? (
          <Button className="mt-5" size="sm" onClick={onActionClick}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
