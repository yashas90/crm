import { cn } from "@propninja/ui/lib/utils";
import { type ButtonHTMLAttributes, type HTMLAttributes, forwardRef } from "react";

type NeuCardProps = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
};

export function NeuCard({ className, hover = true, ...props }: NeuCardProps) {
  return (
    <div
      className={cn(
        "border-2 border-black bg-white shadow-[4px_4px_0_0_#000]",
        hover &&
          "transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#000]",
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
      default: "bg-white text-black",
      primary: "bg-[#C02020] text-white",
      hot: "bg-[#C02020] text-white",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border-2 border-black px-6 py-3 text-sm font-bold shadow-[2px_2px_0_0_#000] transition-all duration-100 active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_0_#000]",
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
      <h2 className="font-heading text-2xl font-bold uppercase italic tracking-tight md:text-3xl">
        {title}
      </h2>
      <div className="h-1 flex-grow bg-black" />
    </div>
  );
}

export function NeuStickyNote({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-2 border-black bg-[#FEF08A] p-6 shadow-[4px_4px_0_0_#000]", className)}
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
        "inline-block border border-black px-3 py-1 text-xs font-bold uppercase",
        variant === "hot" ? "bg-[#C02020] text-white" : "bg-white text-black",
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
        "border-2 border-black bg-white p-4 pb-8 shadow-[4px_4px_0_0_#000]",
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
        <h1 className="font-heading text-3xl font-bold uppercase italic tracking-tighter md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-base font-medium text-neutral-600">{description}</p>
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
        "flex h-10 w-full border-2 border-black bg-white px-3 py-2 text-sm font-medium shadow-[2px_2px_0_0_#000] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]",
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
        "flex h-10 w-full border-2 border-black bg-white px-3 py-2 text-sm font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]",
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
        "min-h-[100px] w-full border-2 border-black bg-white px-3 py-2 text-sm font-medium shadow-[2px_2px_0_0_#000] placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204060]",
        className,
      )}
      {...props}
    />
  );
}
