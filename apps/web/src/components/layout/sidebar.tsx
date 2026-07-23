"use client";

import { AppLogo } from "@/components/layout/app-logo";
import { useSession } from "@/hooks/use-session";
import { cn } from "@propninja/ui/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  BookMarked,
  Building2,
  CheckSquare,
  FileText,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  MapPin,
  Megaphone,
  Phone,
  Radio,
  Settings,
  Shield,
  TrendingUp,
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
  {
    href: "/sla",
    label: "SLA",
    icon: AlertTriangle,
    roles: ["admin", "manager", "agent"],
  },
  { href: "/projects", label: "Projects", icon: Building2, roles: ["admin", "manager", "agent"] },
  {
    href: "/site-visits",
    label: "Site Visits",
    icon: MapPin,
    roles: ["admin", "manager", "agent"],
  },
  {
    href: "/bookings",
    label: "Bookings",
    icon: BookMarked,
    roles: ["admin", "manager", "agent"],
  },
  { href: "/documents", label: "Documents", icon: FileText, roles: ["admin", "manager", "agent"] },
  { href: "/reports/calls", label: "Calls", icon: Phone, roles: ["admin", "manager", "agent"] },
  {
    href: "/performance",
    label: "Performance",
    icon: TrendingUp,
    roles: ["admin", "manager", "agent"],
  },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "manager"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  {
    href: "/reports/revenue",
    label: "Revenue Pipeline",
    icon: LineChart,
    roles: ["admin", "manager"],
  },
  { href: "/reports/sources", label: "Sources", icon: LayoutGrid, roles: ["admin", "manager"] },
  { href: "/users", label: "Users", icon: UserCircle, roles: ["admin", "manager"] },
  { href: "/settings/meta", label: "Meta", icon: Megaphone, roles: ["admin", "manager"] },
  {
    href: "/settings/meta/live",
    label: "Live Meta Leads",
    icon: Radio,
    roles: ["admin", "manager"],
  },
  { href: "/settings/security", label: "Security", icon: Shield, roles: ["admin"] },
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

/** Prefer the longest matching nav href so /settings/meta wins over /settings. */
function isNavItemActive(pathname: string, href: string, items: NavItem[]): boolean {
  const matches = (itemHref: string) =>
    itemHref === "/"
      ? pathname === "/"
      : pathname === itemHref || pathname.startsWith(`${itemHref}/`);

  if (!matches(href)) return false;

  const longerMatch = items.some(
    (item) => item.href !== href && item.href.length > href.length && matches(item.href),
  );
  return !longerMatch;
}

const roleColors: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
  manager: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  agent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
};

const DEFAULT_NAV = navItems.filter((item) => item.roles.includes("agent"));

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { session, ready } = useSession();
  const role = roleFromSession(session?.role);

  const visibleItems =
    ready && role ? navItems.filter((item) => item.roles.includes(role)) : DEFAULT_NAV;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/50 bg-white/90 shadow-[1px_0_24px_0_rgba(0,0,0,0.06)] backdrop-blur-xl transition-transform duration-300 dark:border-slate-700/60 dark:bg-[#0f172a] dark:shadow-[1px_0_32px_0_rgba(0,0,0,0.4)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        )}
      >
        <div className="border-b border-slate-200/80 px-5 py-5 dark:border-slate-700/60">
          <AppLogo />
          <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            Real estate CRM
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-0.5">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(pathname, href, visibleItems);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onMobileClose}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-[#204060]/[0.12] via-[#204060]/[0.07] to-transparent text-[#204060] shadow-[inset_0_0_0_1px_rgba(32,64,96,0.1)] dark:from-indigo-500/20 dark:via-indigo-500/10 dark:to-transparent dark:text-indigo-300 dark:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]"
                      : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[#204060] dark:bg-indigo-400" />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-200",
                      active
                        ? "scale-110 text-[#204060] dark:text-indigo-400"
                        : "text-slate-400 group-hover:scale-105 group-hover:text-slate-600 dark:group-hover:text-slate-200",
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
          <div className="border-t border-slate-200/80 p-3 dark:border-slate-700/60">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-sm dark:from-indigo-500 dark:to-violet-700">
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
    </>
  );
}
