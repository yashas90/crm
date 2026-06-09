"use client";

import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { Copy, RefreshCw, Trash2 } from "lucide-react";

type LeadsPageHeaderActionsProps = {
  onUpdateClick: () => void;
  className?: string;
};

export function LeadsPageHeaderActions({ onUpdateClick, className }: LeadsPageHeaderActionsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={onUpdateClick}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Update
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        disabled
        title="Coming soon"
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicate
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        disabled
        title="Coming soon"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Dropped
      </Button>
    </div>
  );
}
