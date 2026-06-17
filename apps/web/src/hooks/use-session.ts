"use client";

import { type SessionUser, fetchCurrentUser, getSession } from "@/lib/auth";
import { useEffect, useState } from "react";

/** Client-only session state. Initial render matches SSR (null) to avoid hydration mismatches. */
export function useSession() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(getSession());
    setReady(true);
    void fetchCurrentUser().then((user) => {
      if (user) setSession(user);
    });
  }, []);

  return {
    session,
    ready,
    isAdmin: session?.role === "admin",
    isManager: session?.role === "manager",
    isAgent: session?.role === "agent",
    isFirstLogin: session?.isFirstLogin === true,
  };
}
