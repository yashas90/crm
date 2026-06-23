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
    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-[#204060] text-sm font-bold text-white shadow-[2px_2px_0_0_#000]">
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b-2 border-black bg-neu-cream px-6 transition-all duration-300 dark:border-b dark:border-white/10 dark:bg-black/30 dark:backdrop-blur-md">
      <div className="flex flex-1 items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-lg font-bold uppercase tracking-tight dark:text-white dark:font-serif">
            {resolveTitle(pathname)}
          </h1>
          <p className="text-xs font-medium text-neutral-600 dark:text-slate-400">
            PropNinja dashboard
          </p>
        </div>
        <GlobalSearch />
        <button
          type="button"
          className="hidden items-center gap-1 rounded-full border-2 border-black bg-white px-2.5 py-1 text-xs font-bold text-neutral-600 shadow-[2px_2px_0_0_#000] lg:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:shadow-none"
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
        >
          ⌘K
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Badge className="hidden border border-black bg-white text-black shadow-[2px_2px_0_0_#000] sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:shadow-none">
          PropNinja
        </Badge>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white shadow-[2px_2px_0_0_#000] transition-all hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:shadow-none dark:hover:bg-white/10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <NotificationBell />

        <div className="hidden items-center gap-3 rounded-full border-2 border-black bg-white px-3 py-1.5 shadow-[2px_2px_0_0_#000] md:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:shadow-none">
          <UserAvatar name={user?.name ?? "?"} />
          <div className="leading-tight">
            <p className="text-sm font-bold">{user?.name ?? "Signed in"}</p>
            <p className="text-xs capitalize text-neutral-600 dark:text-slate-400">
              {user?.role ?? "—"}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="rounded-full border-2 border-black font-bold shadow-[2px_2px_0_0_#000] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:shadow-none dark:hover:bg-white/10"
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
