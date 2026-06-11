import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN_WEB ?? process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    skipOpenTelemetrySetup: true,
  });
}
