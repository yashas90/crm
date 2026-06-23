import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0_0_#000] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_0_#000] dark:border-white/15 dark:shadow-none dark:active:translate-x-0 dark:active:translate-y-0 dark:active:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#C02020] text-white hover:bg-[#9a1818] dark:bg-red-600/80 dark:hover:bg-red-600",
        destructive:
          "bg-[#204060] text-white hover:bg-[#1a3550] dark:bg-white/10 dark:hover:bg-white/15",
        outline:
          "bg-white text-black hover:bg-neutral-50 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10",
        secondary:
          "bg-[#FEF08A] text-black hover:bg-[#fde047] dark:bg-[var(--gold)]/20 dark:text-[var(--gold)] dark:hover:bg-[var(--gold)]/30",
        ghost:
          "border-transparent bg-transparent shadow-none hover:border-black hover:bg-white hover:shadow-[2px_2px_0_0_#000] active:shadow-[1px_1px_0_0_#000] dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:shadow-none",
        link: "border-transparent bg-transparent text-[#204060] shadow-none underline-offset-4 hover:underline active:translate-x-0 active:translate-y-0 active:shadow-none dark:text-[var(--cyan)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
