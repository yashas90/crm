"use client";

import { FirstLoginModal } from "@/components/auth/first-login-modal";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { StaleDataBanner } from "@/components/ui/stale-data-banner";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { ensureSessionCookie, isAuthenticated } from "@/lib/auth";
import { Button } from "@propninja/ui/button";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

function DashboardErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-muted-foreground">
        {error instanceof Error
          ? error.message
          : "Please try again. If the problem persists, contact support."}
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useNotificationSound();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    ensureSessionCookie();
  }, [router]);

  return (
    <div className="relative min-h-screen bg-[#F4F7FB] text-slate-900 transition-all duration-300 dark:bg-[#0f172a] dark:text-slate-100">
      <div className="absolute inset-0 z-0 hidden dark:block pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.06)_0%,_transparent_60%)]" />
      </div>

      <div className="relative z-10">
        <FirstLoginModal />
        <CommandPalette />
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <div className="md:pl-64">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <StaleDataBanner />
          <main className="p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <QueryErrorResetBoundary>
                {({ reset }) => (
                  <ErrorBoundary onReset={reset} FallbackComponent={DashboardErrorFallback}>
                    {children as ReactNode}
                  </ErrorBoundary>
                )}
              </QueryErrorResetBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
