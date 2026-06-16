"use client";

import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

type TaskSlideOverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
};

export function TaskSlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  widthClassName = "max-w-lg",
}: TaskSlideOverProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close panel"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "relative z-10 flex h-full w-full flex-col border-l border-border bg-background shadow-xl",
          widthClassName,
        )}
      >
        <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-border/60 px-5 py-4">{footer}</div> : null}
      </aside>
    </div>
  );
}
