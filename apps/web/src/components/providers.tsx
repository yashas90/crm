"use client";

import "../../sentry.client.config";
import { KeyboardShortcuts } from "@/components/common/keyboard-shortcuts";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SentryUserSync } from "@/components/sentry-user-sync";
import { makeQueryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SentryUserSync />
        <KeyboardShortcuts />
        {children}
        <Toaster richColors position="top-right" closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
