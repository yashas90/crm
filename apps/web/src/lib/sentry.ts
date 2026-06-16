import * as Sentry from "@sentry/nextjs";
import type { SessionUser } from "./auth";

function isSentryEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN_WEB);
}

export function setSentryUser(user: SessionUser | null): void {
  if (!isSentryEnabled()) return;

  if (user) {
    Sentry.setUser({ id: user.id });
    Sentry.setTag("role", user.role);
  } else {
    Sentry.setUser(null);
  }
}

export function captureClientException(
  error: unknown,
  context?: { user?: SessionUser | null; componentStack?: string | null },
): void {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context?.user) {
      scope.setUser({ id: context.user.id });
      scope.setTag("role", context.user.role);
    }
    if (context?.componentStack) {
      scope.setContext("react", { componentStack: context.componentStack });
    }
    Sentry.captureException(error);
  });
}
