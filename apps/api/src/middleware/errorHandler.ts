import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { jsonError } from "../lib/response.js";
import { captureSentryException } from "../lib/sentry.js";
import { LeadDuplicatePhoneError } from "../services/leadService.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return jsonError(c, err.code, err.message, err.status as 400, err.details);
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

  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  captureSentryException(err, c);

  return jsonError(c, "INTERNAL_ERROR", "Something went wrong", 500);
};
