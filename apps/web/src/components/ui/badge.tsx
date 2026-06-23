import { cn } from "@propninja/ui/lib/utils";

const variants = {
  default: "bg-[#204060] text-white",
  secondary: "bg-[#FEF08A] text-black",
  outline: "bg-white text-black",
  success: "bg-green-100 text-green-900",
  warning: "bg-amber-100 text-amber-900",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-black px-2.5 py-0.5 text-xs font-bold uppercase",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
