import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/lib/sentryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release:
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
      undefined,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend: scrubSentryEvent,
  });
}
