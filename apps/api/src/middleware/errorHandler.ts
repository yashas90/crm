import { randomUUID } from "node:crypto";
import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { OrgScopeError } from "../lib/orgScope.js";
import { jsonError } from "../lib/response.js";
import { captureSentryRouteError } from "../lib/sentry.js";
import { LeadDuplicatePhoneError } from "../services/leadService.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return jsonError(c, err.code, err.message, err.status as 400, err.details);
  }

  if (err instanceof OrgScopeError) {
    return jsonError(c, "FORBIDDEN", err.message, 403);
  }

  if (err instanceof LeadDuplicatePhoneError) {
    return jsonError(c, err.code, err.message, 409);
  }

  if (err instanceof ZodError) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid request", 400, err.flatten());
  }

  if (err.name === "HTTPException") {
    const status = "status" in err && typeof err.status === "number" ? err.status : 400;
    return jsonError(c, "HTTP_ERROR", err.message, status as 400);
  }

  const requestId = c.get("requestId") ?? randomUUID();

  logger.error("Unhandled error", {
    requestId,
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  captureSentryRouteError(err, c);

  if (env.NODE_ENV === "production") {
    return c.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong",
          requestId,
        },
      },
      500,
    );
  }

  return c.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
        stack: err.stack,
        requestId,
      },
    },
    500,
  );
};
