"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewUserPage() {
  const router = useRouter();
  const { ready, isAdmin } = usePermissions();

  useEffect(() => {
    if (ready) {
      router.replace("/users");
    }
  }, [ready, router]);

  if (ready && !isAdmin) {
    return <p className="text-muted-foreground">Redirecting...</p>;
  }

  return <p className="text-muted-foreground">Redirecting to users...</p>;
}
