import { zValidator } from "@hono/zod-validator";
import type { Context, MiddlewareHandler, Next } from "hono";
import type { z } from "zod";
import { jsonError } from "../lib/response.js";

export type ValidationTarget = "json" | "query" | "param";

export type RouteValidationSchema = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

function formatZodFieldErrors(error: z.ZodError, prefix: string) {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (!messages?.length) continue;
    fieldErrors[`${prefix}.${field}`] = messages;
  }

  if (flattened.formErrors.length > 0) {
    fieldErrors[prefix] = flattened.formErrors;
  }

  return fieldErrors;
}

function validationErrorResponse(c: Context, fieldErrors: Record<string, string[]>) {
  return jsonError(c, "VALIDATION_ERROR", "Invalid request", 400, { fieldErrors });
}

/** Single-target validator (json | query | param) with field-level 400 responses. */
export function validateTarget<T extends z.ZodTypeAny>(
  target: ValidationTarget,
  schema: T,
): MiddlewareHandler {
  return zValidator(target, schema, (result, c) => {
    if (result.success === false) {
      const prefix = target === "param" ? "params" : target;
      return validationErrorResponse(c, formatZodFieldErrors(result.error, prefix));
    }
  });
}

/** Validates body, query, and/or params in one middleware. Unknown keys are stripped (Zod default). */
export function validateRequest(schemas: RouteValidationSchema): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const fieldErrors: Record<string, string[]> = {};

    if (schemas.params) {
      const parsed = schemas.params.safeParse(c.req.param());
      if (!parsed.success) {
        Object.assign(fieldErrors, formatZodFieldErrors(parsed.error, "params"));
      } else {
        c.set("validatedParams", parsed.data);
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(c.req.query());
      if (!parsed.success) {
        Object.assign(fieldErrors, formatZodFieldErrors(parsed.error, "query"));
      } else {
        c.set("validatedQuery", parsed.data);
      }
    }

    if (schemas.body) {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return jsonError(c, "VALIDATION_ERROR", "Invalid JSON body", 400);
      }

      const parsed = schemas.body.safeParse(rawBody);
      if (!parsed.success) {
        Object.assign(fieldErrors, formatZodFieldErrors(parsed.error, "body"));
      } else {
        c.set("validatedBody", parsed.data);
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return validationErrorResponse(c, fieldErrors);
    }

    await next();
  };
}

/**
 * Route validation middleware factory.
 * - `validate({ body, query, params })` — composite validation
 * - `validate("json", schema)` — single-target (legacy Hono zValidator wrapper)
 */
export function validate(
  targetOrSchemas: ValidationTarget | RouteValidationSchema,
  schema?: z.ZodTypeAny,
): MiddlewareHandler {
  if (typeof targetOrSchemas === "string" && schema) {
    return validateTarget(targetOrSchemas, schema);
  }
  return validateRequest(targetOrSchemas as RouteValidationSchema);
}

declare module "hono" {
  interface ContextVariableMap {
    validatedBody?: unknown;
    validatedQuery?: unknown;
    validatedParams?: unknown;
  }
}
