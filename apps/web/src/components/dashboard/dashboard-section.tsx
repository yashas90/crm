"use client";

import { EmptyState } from "@/components/common/empty-state";
import { NeuSectionHeading } from "@/components/ui/neubrutal";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

type DashboardSectionProps = {
  title?: string;
  description?: string;
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardSection({
  title,
  description,
  isLoading,
  isError,
  hasData,
  onRetry,
  skeleton,
  children,
  className,
}: DashboardSectionProps) {
  const showSkeleton = isLoading && !hasData;

  return (
    <section className={className ?? "space-y-4"}>
      {title ? (
        <div>
          <NeuSectionHeading title={title} className="mb-2" />
          {description ? (
            <p className="text-sm font-medium text-neutral-600">{description}</p>
          ) : null}
        </div>
      ) : null}

      {showSkeleton ? (
        skeleton
      ) : isError ? (
        <EmptyState
          title="Couldn't load this section"
          description="The report request failed. Check your connection and try again."
          actionLabel="Retry"
          onActionClick={onRetry}
          icon={<AlertCircle className="h-7 w-7" />}
          className="py-8"
        />
      ) : (
        children
      )}
    </section>
  );
}
