import type { Context, Next } from "hono";
import { applySentryUserFromContext, withSentryRequestScope } from "../lib/sentry.js";

export const sentryRequestMiddleware = async (c: Context, next: Next) => {
  await withSentryRequestScope(c, () => next());
};

export const sentryUserMiddleware = async (c: Context, next: Next) => {
  applySentryUserFromContext(c);
  await next();
};
