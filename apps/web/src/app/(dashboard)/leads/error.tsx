"use client";

import { Button } from "@propninja/ui/button";
import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold text-destructive">Something went wrong</h2>
      <p className="max-w-md text-muted-foreground">
        {error.message || "This page could not be loaded. Please try again."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
