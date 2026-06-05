"use client";

import { EmptyState } from "@/components/common/empty-state";
import { ShieldOff } from "lucide-react";

export function AccessDeniedEmptyState({
  description = "This section is limited to managers and admins. Contact your administrator if you need access.",
}: {
  description?: string;
}) {
  return (
    <EmptyState
      title="You don't have access to this section"
      description={description}
      icon={<ShieldOff className="h-7 w-7" />}
    />
  );
}
