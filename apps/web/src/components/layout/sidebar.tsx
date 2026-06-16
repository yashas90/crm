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
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border/60 bg-gradient-to-b from-card/95 via-card/90 to-emerald-500/5 backdrop-blur-xl dark:to-emerald-500/10">
      <div className="border-b border-border/60 px-5 py-5">
        <AppLogo />
        <p className="mt-2 text-xs text-muted-foreground">Real estate CRM</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border/60 p-4 text-xs leading-relaxed text-muted-foreground">
        View & manage only — no outbound calling on web.
      </div>
    </aside>
  );
}
