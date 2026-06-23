"use client";

import { FirstLoginModal } from "@/components/auth/first-login-modal";
import { AppErrorBoundary } from "@/components/common/app-error-boundary";
import { CommandPalette } from "@/components/layout/command-palette";
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
    <div className="min-h-screen bg-neu-cream text-black">
      <FirstLoginModal />
      <CommandPalette />
      <Sidebar />
      <div className="pl-64">
        <Topbar />
        <main className="p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <AppErrorBoundary>{children as ReactNode}</AppErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
