import { cn } from "@propninja/ui/lib/utils";
import { type ButtonHTMLAttributes, type HTMLAttributes, forwardRef } from "react";

type NeuCardProps = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
};

export function NeuCard({ className, hover = true, ...props }: NeuCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md dark:shadow-none",
        hover &&
          "hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/80 dark:hover:border-white/20",
        className,
      )}
      {...props}
    />
  );
}

type NeuButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "hot";
  asChild?: boolean;
};

export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default:
        "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
      primary:
        "bg-[#204060] text-white shadow-sm hover:bg-[#1a3550] dark:bg-[#204060] dark:hover:bg-[#1a3550]",
      hot: "bg-[#C02020] text-white shadow-sm hover:bg-[#9a1818] dark:bg-red-600 dark:hover:bg-red-700",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]/30 dark:focus-visible:ring-[var(--gold)]",
          variants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
NeuButton.displayName = "NeuButton";

export function NeuSectionHeading({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-white">{title}</h2>
      <div className="h-px flex-grow bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

export function NeuStickyNote({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-[var(--cyan)]/20 dark:bg-cyan-500/10 dark:text-cyan-100",
        className,
      )}
      {...props}
    />
  );
}

export function NeuBadge({
  children,
  variant = "hot",
  className,
}: {
  children: React.ReactNode;
  variant?: "hot" | "status";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variant === "hot"
          ? "bg-rose-100 text-rose-700 dark:bg-red-600/30 dark:text-red-400"
          : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function NeuPolaroid({
  children,
  className,
  tilt = "left",
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 pb-8 shadow-sm dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md",
        tilt === "left" ? "-rotate-1" : "rotate-[1.5deg]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-white">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export function NeuInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-[var(--gold)]",
        className,
      )}
      {...props}
    />
  );
}

export function NeuSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]/30 dark:border-white/10 dark:bg-[#0A0F1C] dark:text-white dark:focus-visible:ring-[var(--gold)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function NeuTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[100px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-[var(--gold)]",
        className,
      )}
      {...props}
    />
  );
}
