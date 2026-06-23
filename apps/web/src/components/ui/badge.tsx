import { cn } from "@propninja/ui/lib/utils";

const variants = {
  default: "bg-[#204060]/10 text-[#204060]",
  secondary: "bg-amber-100 text-amber-800",
  outline: "border border-slate-200 bg-white text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
