"use client";

import { useSession } from "@/hooks/use-session";
import { Input } from "@propninja/ui/input";
import { cn } from "@propninja/ui/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  FileText,
  Flame,
  FolderKanban,
  LayoutDashboard,
  MapPin,
  Phone,
  Search,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type CommandItem = {
  id: string;
  label: string;
  href: string;
  keywords?: string;
  icon: React.ReactNode;
  roles?: Array<"admin" | "manager" | "agent">;
};

const NAV_ITEMS: CommandItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    keywords: "home overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    id: "leads",
    label: "Leads",
    href: "/leads",
    keywords: "contacts prospects",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/pipeline",
    keywords: "stages deals",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    keywords: "analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["admin", "manager"],
  },
  {
    id: "calls",
    label: "Call reports",
    href: "/reports/calls",
    keywords: "phone logs",
    icon: <Phone className="h-4 w-4" />,
  },
  {
    id: "projects",
    label: "Projects",
    href: "/projects",
    keywords: "properties inventory",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "site-visits",
    label: "Site Visits",
    href: "/site-visits",
    keywords: "visits calendar appointments",
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    id: "bookings",
    label: "Bookings",
    href: "/bookings",
    keywords: "reserved booked units inventory",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    keywords: "files library pdf",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    keywords: "insights metrics trends team",
    icon: <TrendingUp className="h-4 w-4" />,
    roles: ["admin", "manager"],
  },
  {
    id: "sla",
    label: "Lead SLA",
    href: "/sla",
    keywords: "inactive breach overdue follow-up",
    icon: <AlertTriangle className="h-4 w-4" />,
    roles: ["admin", "manager", "agent"],
  },
  {
    id: "performance",
    label: "Performance",
    href: "/performance",
    keywords: "stats calls leaderboard personal my performance",
    icon: <TrendingUp className="h-4 w-4" />,
    roles: ["admin", "manager", "agent"],
  },
  {
    id: "users",
    label: "Users",
    href: "/users",
    keywords: "team agents",
    icon: <UserPlus className="h-4 w-4" />,
    roles: ["admin", "manager"],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    keywords: "preferences config",
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: "lead-scoring",
    label: "Lead Scoring",
    href: "/settings/lead-scoring",
    keywords: "score hot warm priority rules",
    icon: <Flame className="h-4 w-4" />,
    roles: ["admin", "manager"],
  },
];

export function CommandPalette() {
  const router = useRouter();
  const { session } = useSession();
  const role = session?.role;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const roleItems = useMemo(() => {
    if (!role) return NAV_ITEMS.filter((item) => !item.roles);
    return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
  }, [role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleItems;
    return roleItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q) ||
        item.keywords?.toLowerCase().includes(q),
    );
  }, [query, roleItems]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (event.key === "Enter" && filtered[activeIndex]) {
        event.preventDefault();
        go(filtered[activeIndex].href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, activeIndex, go]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      role="presentation"
      onMouseDown={() => setOpen(false)}
    >
      <dialog
        open
        className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-0 shadow-xl dark:border-white/10 dark:bg-[#0f1623]"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <Search className="h-5 w-5 shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to page or search leads…"
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <kbd className="hidden rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium sm:inline dark:border-white/10 dark:bg-white/10">
            ESC
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm font-medium text-neutral-600">
              No matches. Press Enter to search leads.
            </li>
          ) : (
            filtered.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold",
                    index === activeIndex && "bg-[#204060] text-white",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item.href)}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>

        {query.trim() ? (
          <div className="border-t-2 border-black p-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-neutral-100"
              onClick={() => go(`/leads?search=${encodeURIComponent(query.trim())}`)}
            >
              <Search className="h-4 w-4" />
              Search leads for &ldquo;{query.trim()}&rdquo;
            </button>
          </div>
        ) : (
          <p className="border-t-2 border-black px-4 py-2 text-xs font-medium text-neutral-600">
            <kbd className="rounded border border-black px-1 font-bold">⌘K</kbd> anywhere · ↑↓
            navigate · Enter open
          </p>
        )}
      </dialog>
    </div>
  );
}
