"use client";

import { AppLogo } from "@/components/layout/app-logo";
import { useSession } from "@/hooks/use-session";
import { cn } from "@propninja/ui/lib/utils";
import {
  BarChart3,
  Building2,
  CheckSquare,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Phone,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type UserRole = "admin" | "manager" | "agent";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "agent"] },
  { href: "/leads", label: "Leads", icon: Users, roles: ["admin", "manager", "agent"] },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, roles: ["admin", "manager", "agent"] },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, roles: ["admin", "manager", "agent"] },
  { href: "/projects", label: "Projects", icon: Building2, roles: ["admin", "manager", "agent"] },
  { href: "/reports/calls", label: "Calls", icon: Phone, roles: ["admin", "manager", "agent"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  {
    href: "/reports/revenue",
    label: "Revenue Pipeline",
    icon: LineChart,
    roles: ["admin", "manager"],
  },
  { href: "/reports/sources", label: "Sources", icon: LayoutGrid, roles: ["admin", "manager"] },
  { href: "/users", label: "Users", icon: UserCircle, roles: ["admin", "manager"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "manager", "agent"] },
];

/** Nav visibility uses JWT `users.role` (admin/manager/agent), not display roleLabel. */
function roleFromSession(role: string | undefined): UserRole | null {
  if (role === "admin" || role === "manager" || role === "agent") {
    return role;
  }
  return null;
}

const DEFAULT_NAV = navItems.filter((item) => item.roles.includes("agent"));

export function Sidebar() {
  const pathname = usePathname();
  const { session, ready } = useSession();
  const role = roleFromSession(session?.role);

  const visibleItems =
    ready && role ? navItems.filter((item) => item.roles.includes(role)) : DEFAULT_NAV;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r-2 border-black bg-white shadow-[4px_0_0_0_#000] transition-all duration-300 dark:border-r dark:border-white/10 dark:bg-black/30 dark:backdrop-blur-md dark:shadow-none">
      <div className="border-b-2 border-black px-5 py-5 dark:border-b dark:border-white/10">
        <AppLogo />
        <p className="mt-2 font-heading text-xs font-bold uppercase tracking-wide text-neutral-600 dark:text-slate-400">
          Real estate CRM
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-full border-2 px-3 py-2.5 text-sm font-bold transition-all",
                  active
                    ? "border-black bg-[#204060] text-white shadow-[2px_2px_0_0_#000] dark:border-white/15 dark:bg-white/10 dark:text-[var(--gold)] dark:shadow-none"
                    : "border-transparent text-neutral-600 hover:border-black hover:bg-white hover:shadow-[2px_2px_0_0_#000] dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white dark:hover:shadow-none",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t-2 border-black p-4 text-xs font-medium leading-relaxed text-neutral-600 dark:border-t dark:border-white/10 dark:text-slate-500">
        View & manage only — no outbound calling on web.
      </div>
    </aside>
  );
}
