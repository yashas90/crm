import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";
import { jsonError } from "./response.js";

type ValidationTarget = "json" | "query" | "param";

export function validate<T extends z.ZodTypeAny>(target: ValidationTarget, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return jsonError(c, "VALIDATION_ERROR", "Invalid request", 400, result.error.flatten());
    }
  });
}
