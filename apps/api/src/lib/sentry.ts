import * as Sentry from "@sentry/node";
import type { Context } from "hono";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { scrubSentryEvent } from "./sentryScrub.js";

export const sentryEnabled = Boolean(env.SENTRY_DSN);

function resolveRelease(): string | undefined {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    undefined
  );
}

const sentryOptions: Sentry.NodeOptions = {
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  release: resolveRelease(),
  tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  skipOpenTelemetrySetup: true,
  beforeSend: scrubSentryEvent,
};

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init(sentryOptions);
}

let processHandlersRegistered = false;

/** Capture fatal process-level errors outside the HTTP request cycle. */
export function registerSentryProcessHandlers(): void {
  if (!sentryEnabled || processHandlersRegistered) return;
  processHandlersRegistered = true;

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    Sentry.captureException(reason);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", {
      message: error.message,
      stack: error.stack,
    });
    Sentry.captureException(error);
    void Sentry.flush(2000).finally(() => {
      process.exit(1);
    });
  });
}

function bindAuthUserToScope(c: Context): void {
  if (!sentryEnabled) return;

  try {
    const authUser = c.get("authUser");
    if (!authUser) return;
    Sentry.setUser({ id: authUser.id });
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
          scope.setUser({ id: authUser.id });
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

/** Final error hook — must run after all routes (via Hono onError). */
export function captureSentryRouteError(error: unknown, c: Context): void {
  captureSentryException(error, c);
}
