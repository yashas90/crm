"use client";

import { EmptyState } from "@/components/common/empty-state";
import { AlertCircle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type SectionErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type SectionErrorBoundaryState = {
  hasError: boolean;
};

/** Catches render errors in a dashboard section without crashing the whole page. */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SectionErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <EmptyState
          title={this.props.title ?? "Couldn't load this section"}
          description="Something went wrong while rendering this part of the dashboard."
          actionLabel="Try again"
          onActionClick={() => this.setState({ hasError: false })}
          icon={<AlertCircle className="h-7 w-7" />}
          className="py-8"
        />
      );
    }

    return this.props.children;
  }
}
