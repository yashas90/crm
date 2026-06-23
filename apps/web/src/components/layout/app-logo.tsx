import { cn } from "@propninja/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

export function AppLogo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/logo.png"
        alt="PropNinja"
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className="h-9 w-auto object-contain"
        priority
      />
      {!compact ? (
        <span className="font-heading text-lg font-bold uppercase tracking-tight text-[#204060]">
          Prop<span className="text-[#C02020]">Ninja</span>
        </span>
      ) : null}
    </Link>
  );
}
