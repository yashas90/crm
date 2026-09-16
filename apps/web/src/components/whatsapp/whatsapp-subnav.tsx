"use client";

import { useWhatsAppUnreadCount } from "@/hooks/use-whatsapp-blaster";
import { cn } from "@propninja/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/whatsapp", label: "Blaster", exact: true },
  { href: "/whatsapp/inbox", label: "Inbox" },
  { href: "/whatsapp/leads", label: "WhatsApp Leads" },
  { href: "/whatsapp/campaigns", label: "Campaigns" },
  { href: "/whatsapp/templates", label: "Templates" },
];

export function WhatsAppSubnav() {
  const pathname = usePathname();
  const unread = useWhatsAppUnreadCount();
  const inboxCount = unread.data?.count ?? 0;

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200/80 pb-3 dark:border-white/10">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[#204060]/10 text-[#204060] dark:bg-indigo-500/20 dark:text-indigo-300"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            {tab.label}
            {tab.href === "/whatsapp/inbox" && inboxCount > 0 ? (
              <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#C02020] px-1.5 text-[10px] font-bold text-white">
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
