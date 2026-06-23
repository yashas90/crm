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

function roleFromSession(role: string | undefined): UserRole | null {
  if (role === "admin" || role === "manager" || role === "agent") {
    return role;
  }
  return null;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const roleColors: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
  manager: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  agent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
};

const DEFAULT_NAV = navItems.filter((item) => item.roles.includes("agent"));

export function Sidebar() {
  const pathname = usePathname();
  const { session, ready } = useSession();
  const role = roleFromSession(session?.role);

  const visibleItems =
    ready && role ? navItems.filter((item) => item.roles.includes(role)) : DEFAULT_NAV;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200/80 bg-white shadow-[1px_0_20px_0_rgba(0,0,0,0.04)] transition-all duration-300 dark:border-white/10 dark:bg-black/30 dark:backdrop-blur-md dark:shadow-none">
      <div className="border-b border-slate-200/80 px-5 py-5 dark:border-white/10">
        <AppLogo />
        <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          Real estate CRM
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-0.5">
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
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-gradient-to-r from-[#204060]/10 to-[#204060]/5 text-[#204060] dark:from-white/10 dark:to-white/5 dark:text-[var(--gold)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[#204060] dark:bg-[var(--gold)]" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-[#204060] dark:text-[var(--gold)]"
                      : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white",
                  )}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User profile card */}
      {ready && session && (
        <div className="border-t border-slate-200/80 p-3 dark:border-white/10">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#204060] to-[#2d5a8a] text-xs font-bold text-white shadow-sm">
              {getInitials(session.name ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                {session.name}
              </p>
              <span
                className={cn(
                  "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize leading-none",
                  roleColors[session.role ?? "agent"] ?? roleColors.agent,
                )}
              >
                {session.role}
              </span>
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
