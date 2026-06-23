"use client";

import { AppLogo } from "@/components/layout/app-logo";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { type SessionUser, clearSession, fetchCurrentUser, getSession } from "@/lib/auth";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { LogOut, Moon, Sun } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/leads": "Leads",
  "/reports": "Reports",
  "/reports/calls": "Calls",
  "/reports/sources": "Sources",
  "/reports/team": "Team Performance",
  "/projects": "Projects",
  "/users": "Users",
  "/settings": "Settings",
  "/settings/integrations": "Integrations",
};

function resolveTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname === "/projects/new") return "Add Project";
  if (pathname.startsWith("/projects/")) return "Edit Project";
  if (pathname === "/users/new") return "Add User";
  if (pathname.startsWith("/users/")) return "Edit User";
  if (pathname.startsWith("/leads/")) return "Lead Detail";
  return "PropNinja";
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#204060] text-sm font-semibold text-white shadow-sm">
      {initials}
    </div>
  );
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getSession());
    void fetchCurrentUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  function handleSignOut() {
    clearSession();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm transition-all duration-300 dark:border-white/10 dark:bg-black/30 dark:backdrop-blur-md">
      <div className="flex flex-1 items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white dark:font-serif">
            {resolveTitle(pathname)}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">PropNinja dashboard</p>
        </div>
        <GlobalSearch />
        <button
          type="button"
          className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 lg:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
        >
          ⌘K
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Badge className="hidden rounded-full sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          PropNinja
        </Badge>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />

        <div className="hidden items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm md:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <UserAvatar name={user?.name ?? "?"} />
          <div className="leading-tight">
            <p className="text-sm font-bold">{user?.name ?? "Signed in"}</p>
            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
              {user?.role ?? "—"}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="rounded-lg border border-slate-200 font-semibold shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}

export function MobileTopBrand() {
  return (
    <div className={cn("flex items-center md:hidden")}>
      <AppLogo compact />
    </div>
  );
}
