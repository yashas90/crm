import * as Sentry from "@sentry/node";
import type { Context } from "hono";
import { env } from "./env.js";

export const sentryEnabled = Boolean(env.SENTRY_DSN);

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Avoid a second OpenTelemetry + drizzle-orm resolution path in the monorepo.
    skipOpenTelemetrySetup: true,
  });
}

function bindAuthUserToScope(c: Context): void {
  if (!sentryEnabled) return;

  try {
    const authUser = c.get("authUser");
    if (!authUser) return;
    Sentry.setUser({ id: authUser.id, email: authUser.email });
    Sentry.setTag("role", authUser.role);
  } catch {
    // authUser is not set on unauthenticated routes.
  }
}

function bindRequestToScope(c: Context): void {
  if (!sentryEnabled) return;

  const scope = Sentry.getCurrentScope();
  scope.setTag("path", c.req.path);
  scope.setTag("method", c.req.method);

  try {
    const requestId = c.get("requestId");
    if (requestId) scope.setTag("requestId", requestId);
  } catch {
    // requestId may be unavailable before requestContextMiddleware runs.
  }
}

export function captureSentryException(error: unknown, c?: Context): void {
  if (!sentryEnabled) return;

  Sentry.withScope((scope) => {
    if (c) {
      scope.setTag("path", c.req.path);
      scope.setTag("method", c.req.method);
      try {
        const requestId = c.get("requestId");
        if (requestId) scope.setTag("requestId", requestId);
      } catch {
        // ignore
      }
      try {
        const authUser = c.get("authUser");
        if (authUser) {
          scope.setUser({ id: authUser.id, email: authUser.email });
          scope.setTag("role", authUser.role);
        }
      } catch {
        // ignore
      }
    }
    Sentry.captureException(error);
  });
}

/** Per-request isolation scope and HTTP context tags. */
export async function withSentryRequestScope(c: Context, next: () => Promise<void>): Promise<void> {
  if (!sentryEnabled) {
    await next();
    return;
  }

  await Sentry.withIsolationScope(async () => {
    bindRequestToScope(c);
    try {
      await next();
    } catch (error) {
      bindAuthUserToScope(c);
      captureSentryException(error, c);
      throw error;
    }
  });
}

/** Attach authenticated user to the active Sentry scope (run after authMiddleware). */
export function applySentryUserFromContext(c: Context): void {
  bindAuthUserToScope(c);
}
