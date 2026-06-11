"use client";

import { AppLogo } from "@/components/layout/app-logo";
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
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{resolveTitle(pathname)}</h1>
        <p className="text-xs text-muted-foreground">PropNinja dashboard</p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          PropNinja
        </Badge>

        <NotificationBell />

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="hidden items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-1.5 md:flex">
          <UserAvatar name={user?.name ?? "?"} />
          <div className="leading-tight">
            <p className="text-sm font-medium">{user?.name ?? "Signed in"}</p>
            <p className="text-xs capitalize text-muted-foreground">{user?.role ?? "—"}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleSignOut}>
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
