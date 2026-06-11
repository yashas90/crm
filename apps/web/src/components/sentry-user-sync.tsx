"use client";

import { useSession } from "@/hooks/use-session";
import { setSentryUser } from "@/lib/sentry";
import { useEffect } from "react";

/** Keeps Sentry user scope aligned with the current client session. */
export function SentryUserSync() {
  const { session, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    setSentryUser(session);
  }, [session, ready]);

  return null;
}
