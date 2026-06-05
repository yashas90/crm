import { cn } from "@propninja/ui/lib/utils";
import { ShieldCheck } from "lucide-react";

export function AppLogo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
        <ShieldCheck className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
        <div className="absolute -bottom-0.5 h-1 w-6 rounded-full bg-primary-foreground/30" />
      </div>
      {!compact ? (
        <span className="text-lg font-bold tracking-tight">
          <span className="text-foreground">Prop</span>
          <span className="text-primary">Ninja</span>
        </span>
      ) : null}
    </div>
  );
}
