"use client";

import { FirstLoginModal } from "@/components/auth/first-login-modal";
import { AppErrorBoundary } from "@/components/common/app-error-boundary";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { ensureSessionCookie, isAuthenticated } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useNotificationSound();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    ensureSessionCookie();
  }, [router]);

  return (
    <div className="relative min-h-screen bg-[#F4F7FB] text-slate-900 transition-all duration-300 dark:bg-[#0A0F1C] dark:text-white">
      <div className="absolute inset-0 z-0 hidden dark:block pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1515703944563-dbcfbf121b3d?auto=format&w=1440&q=80&fit=crop"
          className="w-full h-full object-cover opacity-10 blur-sm"
          alt="Luxury Architecture"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0F1C]/80 to-[#0A0F1C]" />
      </div>

      <div className="relative z-10">
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
    </div>
  );
}
