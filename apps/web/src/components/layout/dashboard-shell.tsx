"use client";

import { AppErrorBoundary } from "@/components/common/app-error-boundary";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ensureSessionCookie, isAuthenticated } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    ensureSessionCookie();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-background to-teal-50/30 dark:from-slate-950 dark:via-background dark:to-teal-950/20">
      <Sidebar />
      <div className="pl-64">
        <Topbar />
        <main className="p-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl border border-border/60 bg-card/90 p-6 shadow-sm backdrop-blur-sm">
              <AppErrorBoundary>{children as ReactNode}</AppErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
