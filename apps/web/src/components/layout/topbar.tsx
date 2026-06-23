"use client";

import { AppLogo } from "@/components/layout/app-logo";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { type SessionUser, clearSession, fetchCurrentUser, getSession } from "@/lib/auth";
import { cn } from "@propninja/ui/lib/utils";
import { ChevronRight, Home, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/tasks": "Tasks",
  "/projects": "Projects",
  "/reports": "Reports",
  "/reports/calls": "Calls",
  "/reports/sources": "Sources",
  "/reports/revenue": "Revenue Pipeline",
  "/reports/team": "Team Performance",
  "/users": "Users",
  "/settings": "Settings",
  "/settings/integrations": "Integrations",
};

function segmentLabel(seg: string, fullPath: string): string {
  if (PAGE_TITLES[fullPath]) return PAGE_TITLES[fullPath];
  if (fullPath === "/projects/new") return "Add Project";
  if (fullPath.startsWith("/projects/")) return "Edit Project";
  if (fullPath === "/users/new") return "Add User";
  if (fullPath.startsWith("/users/")) return "Edit User";
  if (fullPath.startsWith("/leads/")) return "Lead Detail";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-semibold text-slate-900 dark:text-white">Overview</span>;
  }

  const crumbs: { label: string; href: string }[] = [];
  let path = "";
  for (const seg of segments) {
    path += `/${seg}`;
    crumbs.push({ label: segmentLabel(seg, path), href: path });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/"
        className="flex items-center text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          {i === crumbs.length - 1 ? (
            <span className="font-semibold text-slate-900 dark:text-white">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#204060] to-[#2d5a8a] text-sm font-semibold text-white shadow-sm">
      {initials}
    </div>
  );
}

function UserMenu({ user, onSignOut }: { user: SessionUser | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-1.5 shadow-sm transition-colors",
          open
            ? "border-[#204060]/30 bg-[#204060]/5 dark:border-white/20 dark:bg-white/10"
            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
        )}
      >
        <UserAvatar name={user?.name ?? "?"} />
        <div className="leading-tight text-left">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {user?.name ?? "Signed in"}
          </p>
          <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
            {user?.role ?? "—"}
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-[#0f1623]">
          <div className="border-b border-slate-100 px-4 py-2.5 dark:border-white/10">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{user?.role}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Settings className="h-4 w-4 text-slate-400" />
            Settings
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <User className="h-4 w-4 text-slate-400" />
            Profile
          </Link>
          <div className="my-1 border-t border-slate-100 dark:border-white/10" />
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/40 bg-white/75 px-6 shadow-[0_1px_12px_0_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-[#0a0f1a]/70 dark:backdrop-blur-xl">
      <div className="flex flex-1 items-center gap-4">
        <Breadcrumbs pathname={pathname} />
        <GlobalSearch />
        <button
          type="button"
          className="hidden items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 lg:flex dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
        >
          ⌘K
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Badge className="hidden rounded-full text-xs sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          PropNinja
        </Badge>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <NotificationBell />

        <UserMenu user={user} onSignOut={handleSignOut} />

        {/* Mobile sign-out fallback */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-600 md:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
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
